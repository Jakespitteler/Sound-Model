import json
import socket
import subprocess
import sys
import time
import unittest
import urllib.error
import urllib.request


class HTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with socket.socket() as s:
            s.bind(('127.0.0.1', 0))
            port = s.getsockname()[1]
        cls.url = f'http://127.0.0.1:{port}'
        cls.process = subprocess.Popen([sys.executable, 'run.py', '--no-browser', '--port', str(port)],
                                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        cls.addClassCleanup(cls.stop)
        for _ in range(80):
            try:
                with urllib.request.urlopen(cls.url + '/api/health', timeout=0.5):
                    return
            except OSError:
                if cls.process.poll() is not None:
                    raise RuntimeError('Server exited during startup')
                time.sleep(0.05)
        raise RuntimeError('Server did not become ready')

    @classmethod
    def stop(cls):
        cls.process.terminate()
        try:
            cls.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            cls.process.kill()
            cls.process.wait()

    def post(self, payload):
        request = urllib.request.Request(self.url + '/api/predict', json.dumps(payload).encode(),
                                         {'Content-Type': 'application/json'})
        with urllib.request.urlopen(request, timeout=5) as response:
            return json.load(response)

    def test_serves_local_frontend(self):
        for path, fragment in [('/', b'Sound-Model'), ('/app.js', b'api/predict'),
                               ('/style.css', b'.sidebar'), ('/vendor/leaflet/leaflet.js', b'Leaflet')]:
            with self.subTest(path=path), urllib.request.urlopen(self.url + path) as response:
                self.assertEqual(response.status, 200)
                self.assertIn(fragment, response.read())

    def test_actual_prediction_request(self):
        result = self.post({'types': [{'id': 't', 'name': 'Test', 'lwa': 100}],
                            'sources': [{'id': 's', 'type_id': 't', 'lat': 0, 'lng': 0}],
                            'receivers': [{'id': 'r', 'lat': 0, 'lng': 0.001}]})
        self.assertAlmostEqual(result['receivers'][0]['level_db'], 48.086, places=2)
        self.assertTrue(result['example_data'])

    def test_rejects_invalid_references(self):
        with self.assertRaises(urllib.error.HTTPError) as caught:
            self.post({'sources': [{'id': 's', 'type_id': 'missing', 'lat': 0, 'lng': 0}]})
        self.assertEqual(caught.exception.code, 422)

    def test_empty_scenario(self):
        result = self.post({})
        self.assertIsNone(result['grid'])
        self.assertEqual(result['receivers'], [])

    def test_nonfinite_input_is_validation_error(self):
        for literal in ('1e999', 'NaN', 'Infinity'):
            request = urllib.request.Request(self.url + '/api/predict',
                ('{"receivers":[{"id":"r","lat":' + literal + ',"lng":0}]}').encode(),
                {'Content-Type': 'application/json'})
            with self.subTest(literal=literal), self.assertRaises(urllib.error.HTTPError) as caught:
                urllib.request.urlopen(request)
            self.assertEqual(caught.exception.code, 422)
            error = json.load(caught.exception)
            self.assertIn('detail', error)
            self.assertNotIn('input', error['detail'][0])

    def test_private_repository_files_not_served(self):
        for path in ['/requirements.txt', '/.git/config', '/run.py']:
            with self.subTest(path=path), self.assertRaises(urllib.error.HTTPError) as caught:
                urllib.request.urlopen(self.url + path)
            self.assertEqual(caught.exception.code, 404)
