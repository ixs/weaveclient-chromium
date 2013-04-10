from google.appengine.ext.webapp.util import run_wsgi_app
from google.appengine.api import urlfetch
from google.appengine.ext import db
from webob import Request, Response

import logging

SERVER = "https://auth.services.mozilla.com"

class StorageNode(db.Model):
    user = db.StringProperty()
    url = db.StringProperty()


def getStorageNode(user):
    node = list(StorageNode.gql('WHERE user = :1', user))
    if node:
        return node[0]

    # We haven't got an entry, so let's fetch it from the server
    url = SERVER + '/user/1.0/' + user + '/node/weave'
    result = urlfetch.fetch(url)
    node = StorageNode(user=user, url=result.content)
    node.put()
    logging.debug("Got storage node for user " + user + ": " + node.url)
    return node

def weave_app(environ, start_response):
    request = Request(environ)
    response = Response()

    # Poor man's URL dispatch.
    path_elements = request.path.split('/')
    if (request.path.startswith('/user/1.0/') and
        request.path.endswith('/node/weave')):
        # Client is asking for the Weave storage node.  Tell it it's
        # us, but remember the actual storage node for future
        # reference.
        user = path_elements[3]
        getStorageNode(user)
        response.body = request.application_url
    elif request.path.startswith('/1.0/'):
        user = path_elements[2]
        node = getStorageNode(user)

        url = node.url + request.path_qs
        authorization = request.headers.get('Authorization')
        if not authorization:
            response.status = 401
            response.headers['WWW-Authenticate'] = 'Basic realm="weave"'
            response.body = "Unauthorized"
        else:
            copy = ['Authorization', 'Content-Type', 'Accept']
            headers = dict((header, request.headers.get(header, ''))
                           for header in copy)
            result = urlfetch.fetch(url, request.body, request.method, headers)
            response.body = result.content
            response.status = int(result.status_code)
            response.headers['Content-Type'] = result.headers.get('Content-Type', '')
            #TODO copy X-Weave headers as well if present

    else:
        response.status = 404
        response.body = "Not Found"
    return response(environ, start_response)

def main():
    run_wsgi_app(weave_app)

if __name__ == "__main__":
    main()
