# Solr
import tempfile

def _run_solr_proxy(port):
    conf = tempfile.NamedTemporaryFile(mode='w', delete=False)
    conf.write('''
LogLevel Warning
PidFile "/run/tinyproxy/tinyproxy.pid"
Logfile "/tmp/tinyproxy-solr.log"
MaxClients 5
MinSpareServers 5
MaxSpareServers 20
StartServers 10
Port {port}
ReverseOnly Yes
Upstream http localhost:8983
'''.format(port=port))
    conf.close()
    return ['tinyproxy', '-d', '-c', conf.name]

c.ServerProxy.servers = {
  'solr': {
    'command': _run_solr_proxy,
    'absolute_url': True,
    'timeout': 30,
  }
}
