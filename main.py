from application import create_app

app = create_app(config_name='production')
if __name__ == '__main__':
    app.run(port=5000)