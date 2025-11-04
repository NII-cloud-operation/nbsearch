import os

# Configuration for local development with docker-compose
c.NBSearchDB.solr_base_url = 'http://localhost:8983'
c.NBSearchDB.s3_endpoint_url = 'http://localhost:9000'
c.NBSearchDB.s3_access_key = 'nbsearchak'
c.NBSearchDB.s3_secret_key = 'nbsearchsk'

c.LocalSource.base_dir = os.getcwd()
