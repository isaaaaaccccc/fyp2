import os
import sys
import threading
import time
import webbrowser
from application import create_app

def open_browser():
    """Open browser after a short delay to ensure server is running"""
    time.sleep(2)
    webbrowser.open('http://127.0.0.1:5000')

def main():
    app = create_app(config_name='production')
    
    # Open browser in a separate thread
    browser_thread = threading.Thread(target=open_browser)
    browser_thread.daemon = True
    browser_thread.start()
    
    # Run the Flask app
    try:
        app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)
    except KeyboardInterrupt:
        print("Application stopped.")
        sys.exit(0)

if __name__ == '__main__':
    main()