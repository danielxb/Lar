import os
import sys
import tempfile
import pytest

# Add src/ to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
os.environ["PROJECT_ROOT"] = os.path.join(os.path.dirname(__file__), "..")

@pytest.fixture
def client():
    """Fresh test client with isolated temp DB for each test."""
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    os.environ["DB_PATH"] = tmp.name

    # Must reimport to pick up new DB_PATH each time
    import importlib
    import server as srv
    importlib.reload(srv)
    srv.DB_PATH = type(srv.DB_PATH)(tmp.name)
    srv.init_db()
    srv.app.config["TESTING"] = True

    yield srv.app.test_client()
    os.unlink(tmp.name)
