import logging
import sys


def setup_logger():
    # Use a specific name for the app
    logger = logging.getLogger("tiny_readread")

    # [CRITICAL] Set to DEBUG to catch everything during this phase
    logger.setLevel(logging.DEBUG)

    # Format includes thread ID to detect if tasks are actually running in parallel
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-7s | %(name)s | TID:%(thread)d | %(message)s",
        datefmt="%H:%M:%S",
    )

    # Stream to stdout for Docker/Uvicorn visibility
    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)

    # Ensure we don't double-add handlers on reload
    if not logger.handlers:
        logger.addHandler(stream_handler)

    # Prevent propagation to the root logger which might be suppressed by uvicorn
    logger.propagate = False

    return logger


log = setup_logger()
