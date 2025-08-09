# -*- mode: python ; coding: utf-8 -*-
import os

block_cipher = None

# Get the path to your project directory
project_dir = os.path.abspath('.')

a = Analysis(
    ['main.py'],
    pathex=[project_dir],
    binaries=[],
    datas=[
        ('application/templates', 'application/templates'),
        ('application/static', 'application/static'),
        ('config.py', '.'),
        ('application', 'application'),  # Include the entire application directory
    ],
    hiddenimports=[
        'flask',
        'flask.templating',
        'flask.json.tag',
        'jinja2',
        'jinja2.ext',
        'werkzeug',
        'werkzeug.serving',
        'werkzeug.utils',
        'sqlalchemy',
        'sqlalchemy.dialects.sqlite',
        'dotenv',
        'threading',
        'webbrowser',
        'flask_sqlalchemy',
        'flask_bcrypt',
        'flask_login',
        'flask_wtf',
        'wtforms',
        'pandas',
        'numpy',
        'openpyxl',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='BFG_SchedulerApp',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,  # Set to False to hide console window
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='BFG_SchedulerApp',
)

app = BUNDLE(
    coll,
    name='BFG_SchedulerApp.app',
    icon=None,  # You can add an icon file here if you have one
    bundle_identifier='com.yourname.bfgschedulerapp',
    info_plist={
        'CFBundleName': 'BFG Scheduler App',
        'CFBundleDisplayName': 'BFG Scheduler App',
        'CFBundleIdentifier': 'com.yourname.bfgschedulerapp',
        'CFBundleVersion': '1.0.0',
        'CFBundleShortVersionString': '1.0.0',
        'NSHighResolutionCapable': True,
    },
)