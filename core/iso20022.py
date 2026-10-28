"""
Passerelle Bi-directionnelle ISO 8583 <---> ISO 20022 (pacs.008 / pacs.002 / camt.053).
Module de conversion monétique pour le Paiement Instantané et les Switchs Interbancaires.
Conçu & Réalisé par M. Oury — Ingénieur IT Banking & Architecte Monétique - CBS.
"""

import xml.etree.ElementTree as ET
from xml.dom import minidom
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple
from core.iso8583 import ISO8583Message, mask_pan


# Dictionnaire de correspondance officiel ISO 8583 <-> ISO 20022
ISO_MAPPING_MATRIX: List[Dict[str, Any]] = [
    {
        "de": 2,
        "name": "Primary Account Number (PAN)",
        "iso20022_xpath": "DbtrAcct/Id/Othr/Id",
        "desc": "Identifiant du compte ou carte débitée",
        "xml_block": "DebtorAccount"
    },
    {
        "de": 3,
        "name": "Processing Code",
        "iso20022_xpath": "PmtTpInf/CtgyPurp/Cd",
        "desc": "Code de traitement monétique (000000=Achat, 010000=Retrait)",
        "xml_block": "PaymentTypeInformation"
    },
    {
        "de": 4,
        "name": "Amount, Transaction",
        "iso20022_xpath": "IntrBkSttlmAmt",
        "desc": "Montant interbancaire de la transaction",
        "xml_block": "InterbankSettlementAmount"
    },
    {
        "de": 7,
        "name": "Transmission Date & Time",
        "iso20022_xpath": "CreDtTm",
        "desc": "Horodatage de création du message au format ISO 8601",
        "xml_block": "GroupHeader"
    },
    {
        "de": 11,
        "name": "Systems Trace Audit Number (STAN)",
        "iso20022_xpath": "PmtId/TxId",
        "desc": "Identifiant unique de transaction de bout en bout",
        "xml_block": "PaymentIdentification"
    },
    {
        "de": 18,
        "name": "Merchant Type / Category Code (MCC)",
        "iso20022_xpath": "Purp/Cd",
        "desc": "Code catégorie de marchand ou objet de la transaction",
        "xml_block": "Purpose"
    },
    {
        "de": 37,
        "name": "Retrieval Reference Number (RRN)",
        "iso20022_xpath": "PmtId/EndToEndId",
        "desc": "Numéro de référence acquéreur de réconciliation RRN",
        "xml_block": "PaymentIdentification"
    },
    {
        "de": 38,
        "name": "Authorization Identification Response",
        "iso20022_xpath": "TxInfAndSts/ClrSysRef",
        "desc": "Code d'accord d'autorisation Hôte",
        "xml_block": "TransactionInformationAndStatus"
    },
    {
        "de": 39,
        "name": "Response Code",
        "iso20022_xpath": "TxInfAndSts/TxSts + StsRsnInf/Rsn/Cd",
        "desc": "Statut de paiement (ACCP ou RJCT) et code motif de rejet",
        "xml_block": "StatusReasonInformation"
    },
    {
        "de": 41,
        "name": "Card Acceptor Terminal ID (TID)",
        "iso20022_xpath": "SplmtryData/Envlp/TrmnlId",
        "desc": "Identifiant du terminal TPE ou GAB",
        "xml_block": "SupplementaryData"
    },
    {
        "de": 42,
        "name": "Card Acceptor Identification Code (MID)",
        "iso20022_xpath": "Cdtr/Id/OrgId/Othr/Id",
        "desc": "Identifiant commerçant ou agence bancaire",
        "xml_block": "Creditor"
    },
    {
        "de": 49,
        "name": "Currency Code, Transaction",
        "iso20022_xpath": "IntrBkSttlmAmt/@Ccy",
        "desc": "Devise de règlement ISO 4217 (952 -> XOF, 978 -> EUR)",
        "xml_block": "InterbankSettlementAmount"
    },
]

# Table de conversion des devises ISO 4217 numérique vers alpha-3
CURRENCY_MAP = {
    "952": "XOF",
    "978": "EUR",
    "840": "USD",
    "950": "XAF",
}

# Table de conversion des codes réponses DE 39 vers codes ISO 20022
DE39_TO_ISO20022_STATUS = {
    "00": {"status": "ACCP", "reason": "AC00", "desc": "Transaction acceptée et réglée avec succès"},
    "05": {"status": "RJCT", "reason": "AG01", "desc": "Refus général émetteur (Do Not Honor)"},
    "51": {"status": "RJCT", "reason": "AM04", "desc": "Fonds insuffisants sur le compte (Insufficient Funds)"},
    "54": {"status": "RJCT", "reason": "EX01", "desc": "Carte bancaire expirée"},
    "55": {"status": "RJCT", "reason": "AC04", "desc": "Code PIN erroné ou cryptogramme invalide"},
    "68": {"status": "RJCT", "reason": "TO01", "desc": "Expiration du délai de réponse (Timeout)"},
    "91": {"status": "RJCT", "reason": "AC06", "desc": "Serveur émetteur ou switch inaccessible"},
    "96": {"status": "RJCT", "reason": "MS03", "desc": "Erreur technique système hôte"},
}


class ISO20022Bridge:
    """
    Passerelle de conversion bidirectionnelle ISO 8583 <---> ISO 20022.
    """

    @staticmethod
    def get_mapping_matrix() -> List[Dict[str, Any]]:
        """Retourne la matrice de correspondance complète."""
        return ISO_MAPPING_MATRIX

    @staticmethod
    def iso8583_to_pacs008(msg: ISO8583Message) -> str:
        """
        Convertit une demande financière ISO 8583 (MTI 0200) ou pré-autorisation (0100)
        en message XML ISO 20022 pacs.008.001.08 (Customer Credit Transfer / Instant Payment).
        """
        now_iso = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        pan = msg.get_field(2, "4000123456780001")
        masked_pan = mask_pan(pan)
        raw_amt = msg.get_field(4, "0")
        try:
            amount_val = f"{int(raw_amt) / 100:.2f}" if int(raw_amt) > 0 else "0.00"
        except Exception:
            amount_val = "0.00"

        ccy_num = msg.get_field(49, "952")
        ccy_code = CURRENCY_MAP.get(ccy_num, "XOF")
        stan = msg.get_field(11, "000001")
        rrn = msg.get_field(37, f"RRN{stan}").strip()
        tid = msg.get_field(41, "TERM0001").strip()
        mid = msg.get_field(42, "MERCHANT0001").strip()
        mcc = msg.get_field(18, "5411")
        proc_code = msg.get_field(3, "000000")

        msg_id = f"MSG-ISO8583-{stan}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

        xml_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>{msg_id}</MsgId>
      <CreDtTm>{now_iso}</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <SttlmInf>
        <SttlmMtd>CLRG</SttlmMtd>
        <ClrSys>
          <Prtry>GIM-UEMOA-INSTANT</Prtry>
        </ClrSys>
      </SttlmInf>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId>
        <EndToEndId>{rrn}</EndToEndId>
        <TxId>{stan}</TxId>
      </PmtId>
      <PmtTpInf>
        <SvcLvl>
          <Cd>SDVA</Cd>
        </SvcLvl>
        <LclInstrm>
          <Prtry>INSTANT_CARD_PAYMENT</Prtry>
        </LclInstrm>
        <CtgyPurp>
          <Cd>{proc_code[:4]}</Cd>
        </CtgyPurp>
      </PmtTpInf>
      <IntrBkSttlmAmt Ccy="{ccy_code}">{amount_val}</IntrBkSttlmAmt>
      <ChrgBr>SLEV</ChrgBr>
      <Dbtr>
        <Nm>PORTEUR DE CARTE BANCAIRE</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <Othr>
            <Id>{masked_pan}</Id>
            <SchmeNm>
              <Prtry>PAN_PCI_MASKED</Prtry>
            </SchmeNm>
          </Othr>
        </Id>
      </DbtrAcct>
      <DbtrAgt>
        <FinInstnId>
          <ClrSysMmbId>
            <ClrSysId>
              <Cd>GIM</Cd>
            </ClrSysId>
            <MmbId>CI001</MmbId>
          </ClrSysMmbId>
        </FinInstnId>
      </DbtrAgt>
      <CdtrAgt>
        <FinInstnId>
          <ClrSysMmbId>
            <ClrSysId>
              <Cd>GIM</Cd>
            </ClrSysId>
            <MmbId>SN002</MmbId>
          </ClrSysMmbId>
        </FinInstnId>
      </CdtrAgt>
      <Cdtr>
        <Nm>MARCHAND ACCEPTEUR / COMMERCE</Nm>
        <Id>
          <OrgId>
            <Othr>
              <Id>{mid}</Id>
            </Othr>
          </OrgId>
        </Id>
      </Cdtr>
      <Purp>
        <Cd>{mcc}</Cd>
      </Purp>
      <SplmtryData>
        <Envlp>
          <ISO8583SourceMTI>{msg.mti}</ISO8583SourceMTI>
          <TrmnlId>{tid}</TrmnlId>
        </Envlp>
      </SplmtryData>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>"""
        return xml_content

    @staticmethod
    def iso8583_to_pacs002(msg: ISO8583Message) -> str:
        """
        Convertit une réponse ISO 8583 (MTI 0210 / 0110) en message XML ISO 20022 pacs.002.001.10
        (Payment Status Report / Notification d'Accord ou Rejet).
        """
        now_iso = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        de39 = msg.get_field(39, "00")
        meta = DE39_TO_ISO20022_STATUS.get(de39, {
            "status": "RJCT",
            "reason": "NARR",
            "desc": f"Code DE 39 non standard ({de39})"
        })

        stan = msg.get_field(11, "000001")
        rrn = msg.get_field(37, f"RRN{stan}").strip()
        de38 = msg.get_field(38, "AUTH01").strip()
        msg_id = f"MSG-STATUS-{stan}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

        xml_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.002.001.10">
  <FIToFIPmtStsRpt>
    <GrpHdr>
      <MsgId>{msg_id}</MsgId>
      <CreDtTm>{now_iso}</CreDtTm>
    </GrpHdr>
    <TxInfAndSts>
      <OrgnlEndToEndId>{rrn}</OrgnlEndToEndId>
      <OrgnlTxId>{stan}</OrgnlTxId>
      <TxSts>{meta['status']}</TxSts>
      <StsRsnInf>
        <Rsn>
          <Cd>{meta['reason']}</Cd>
        </Rsn>
        <AddtlInf>{meta['desc']} (DE 39 = {de39})</AddtlInf>
      </StsRsnInf>
      <ClrSysRef>{de38 or 'NONE'}</ClrSysRef>
    </TxInfAndSts>
  </FIToFIPmtStsRpt>
</Document>"""
        return xml_content

    @staticmethod
    def pacs008_to_iso8583(xml_str: str) -> Dict[str, Any]:
        """
        Parse un document XML pacs.008 et reconstruit un dictionnaire de champs ISO 8583.
        """
        try:
            # Nettoyage des namespaces pour parsing aisé
            root = ET.fromstring(xml_str)
            # Retrait des namespaces xmlns
            for elem in root.iter():
                if "}" in elem.tag:
                    elem.tag = elem.tag.split("}", 1)[1]

            tx_elem = root.find(".//CdtTrfTxInf")
            if tx_elem is None:
                raise ValueError("Élément CdtTrfTxInf introuvable dans le document pacs.008.")

            # Extraction STAN
            tx_id_elem = tx_elem.find(".//TxId")
            stan = tx_id_elem.text if tx_id_elem is not None and tx_id_elem.text else "000001"

            # Extraction RRN
            e2e_elem = tx_elem.find(".//EndToEndId")
            rrn = e2e_elem.text if e2e_elem is not None and e2e_elem.text else f"RRN{stan}"

            # Extraction Montant & Devise
            amt_elem = tx_elem.find(".//IntrBkSttlmAmt")
            amount_val = amt_elem.text if amt_elem is not None and amt_elem.text else "0.00"
            ccy = amt_elem.get("Ccy", "XOF") if amt_elem is not None else "XOF"
            amt_cents = int(float(amount_val) * 100)

            # Extraction PAN / Compte
            pan_elem = tx_elem.find(".//DbtrAcct/Id/Othr/Id")
            pan = pan_elem.text if pan_elem is not None and pan_elem.text else "4000123456780001"

            # Construction de l'objet ISO 8583
            iso_fields = {
                "2": pan,
                "3": "000000",
                "4": str(amt_cents).zfill(12),
                "7": datetime.utcnow().strftime("%m%d%H%M%S"),
                "11": stan.zfill(6),
                "18": "5411",
                "22": "051",
                "25": "00",
                "37": rrn[:12].ljust(12),
                "41": "TERM0001",
                "42": "MERCHANT0001".ljust(15),
                "49": "952" if ccy == "XOF" else ("978" if ccy == "EUR" else "840")
            }

            return {
                "success": True,
                "mti": "0200",
                "fields": iso_fields,
                "extracted": {
                    "pan": pan,
                    "amount_cents": amt_cents,
                    "currency": ccy,
                    "stan": stan,
                    "rrn": rrn
                }
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Erreur de parsing XML pacs.008 : {str(e)}"
            }


iso20022_bridge = ISO20022Bridge()
