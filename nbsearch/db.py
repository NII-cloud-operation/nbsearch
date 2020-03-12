import motor.motor_tornado
from traitlets.config.configurable import Configurable
from traitlets import Unicode, Int


class NBSearchDB(Configurable):

    hostname = Unicode('localhost', help='The hostname of MongoDB').tag(config=True)

    port = Int(27017, help='The port of MongoDB').tag(config=True)

    username = Unicode(help='The username of authenticated user').tag(config=True)

    password = Unicode(help='The password of authenticated user').tag(config=True)

    database = Unicode('nbsearch', help='The database on MongoDB').tag(config=True)

    collection = Unicode('notebooks', help='The collection of notebooks').tag(config=True)

    history = Unicode('history', help='The collection of history').tag(config=True)

    def get_database(self):
        client = motor.motor_tornado.MotorClient(self.hostname, self.port,
                                                 username=self.username,
                                                 password=self.password)
        return client[self.database]
