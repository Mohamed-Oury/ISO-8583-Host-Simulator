"""
Point d'entrée principal de la plateforme ISO 8583 Host Authorization.
Lance conjointement :
1. Le serveur d'écoute TCP ISO 8583 (Cadrage 2-octets Big-Endian) sur le port 5001
2. Le serveur Web FastAPI & WebSocket sur le port 8000
"""

import asyncio
import logging
import uvicorn
from core.tcp_server import tcp_server
from web.server import app

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("ISO8583_Launcher")


async def main():
    # 1. Démarrage du serveur TCP ISO 8583
    tcp_server.host = "127.0.0.1"
    tcp_server.port = 5001
    await tcp_server.start()

    logger.info("=" * 70)
    logger.info("⚡ SERVEUR D'AUTORISATION ISO 8583 EN ÉCOUTE")
    logger.info(f"   TCP Host Socket : {tcp_server.host}:{tcp_server.port}")
    logger.info("   Framing         : En-tête binaire 2-octets Big-Endian (!H)")
    logger.info("   Conformité      : PCI-DSS masquage 6/4 actif")
    logger.info("=" * 70)
    logger.info("🌐 INTERFACE WEB DE QUALIFICATION ET DE TEST")
    logger.info("   URL Dashboard   : http://127.0.0.1:8000")
    logger.info("=" * 70)

    # 2. Configuration et exécution du serveur web uvicorn
    config = uvicorn.Config(
        app=app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
        loop="asyncio"
    )
    server = uvicorn.Server(config)
    
    try:
        await server.serve()
    finally:
        logger.info("Arrêt du serveur TCP...")
        await tcp_server.stop()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Arrêt demandé par l'utilisateur.")
