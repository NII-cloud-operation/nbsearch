import os

c.NBSearchDB.solr_base_url = 'http://localhost:8983'
c.NBSearchDB.s3_endpoint_url = 'http://localhost:9000'
c.NBSearchDB.s3_access_key = os.environ['SEAWEEDFS_ACCESS_KEY']
c.NBSearchDB.s3_secret_key = os.environ['SEAWEEDFS_SECRET_KEY']

c.LocalSource.base_dir = '/home/jovyan'
