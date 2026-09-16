"""Allow ``python -m cli`` from the backend package root."""

from cli.main import main

if __name__ == "__main__":
    main()
