from datetime import datetime

from tornado import gen
import tornado.ioloop
import tornado.web


class MainHandler(tornado.web.RequestHandler):
    def get(self):
        now = datetime.now()
        self.render('main.html', current_time=int(now.timestamp()))
