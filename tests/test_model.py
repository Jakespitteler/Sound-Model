import math
import unittest
from pydantic import ValidationError
from app.acoustics import combine, distance_metres, source_level
from app.main import Position, Scenario, predict


class ModelTests(unittest.TestCase):
    def scenario(self, **changes):
        data = dict(types=[dict(id='t', name='Example', lwa=100)],
                    sources=[dict(id='s', type_id='t', lat=0, lng=0)],
                    receivers=[dict(id='r', lat=0, lng=0.001)])
        data.update(changes)
        return Scenario(**data)

    def test_reference_level(self):
        self.assertAlmostEqual(source_level(100, 10), 69.00790136, places=6)

    def test_distance_doubling(self):
        self.assertAlmostEqual(source_level(100, 10) - source_level(100, 20), 6.02059991)

    def test_energetic_sum(self):
        self.assertAlmostEqual(combine([60, 60]), 63.01029996)
        self.assertAlmostEqual(combine([160, -160]), 160)
        self.assertIsNone(combine([]))

    def test_geodesic(self):
        self.assertAlmostEqual(distance_metres(Position(lat=0, lng=0), Position(lat=0, lng=1)), 111195.0802, places=3)
        self.assertLess(distance_metres(Position(lat=0, lng=179.999), Position(lat=0, lng=-179.999)), 223)

    def test_combination_and_removal(self):
        one = predict(self.scenario())['receivers'][0]['level_db']
        two = predict(self.scenario(sources=[dict(id=str(i), type_id='t', lat=0, lng=0) for i in range(2)]))
        self.assertAlmostEqual(two['receivers'][0]['level_db'] - one, 3.01029996)
        empty = predict(self.scenario(sources=[]))
        self.assertIsNone(empty['receivers'][0]['level_db'])
        self.assertIsNone(empty['grid'])

    def test_clouds_do_not_invent_correction(self):
        a = predict(self.scenario(cloud_cover=0))
        b = predict(self.scenario(cloud_cover=100))
        self.assertEqual(a['receivers'], b['receivers'])
        self.assertIsNone(b['cloud_correction_db'])

    def test_near_field_is_flagged(self):
        result = predict(self.scenario(receivers=[dict(id='r', lat=0, lng=0)]))['receivers'][0]
        self.assertTrue(result['near_field'])
        self.assertTrue(math.isfinite(result['level_db']))

    def test_grid_centres_match_receiver(self):
        bounds = dict(south=-0.01, north=0.01, west=-0.01, east=0.01)
        result = predict(self.scenario(bounds=bounds))
        grid = result['grid']
        self.assertEqual(len(grid['values']), 48 * 48)
        self.assertTrue(all(math.isfinite(v) for v in grid['values']))
        # Grid values have Mercator-spaced latitude, linear longitude.
        from app.acoustics import inverse_mercator, mercator_y
        lat = inverse_mercator(mercator_y(0.01) + (mercator_y(-0.01) - mercator_y(0.01)) / 96)
        expected = predict(self.scenario(receivers=[dict(id='r', lat=lat, lng=-0.01 + 0.02 / 96)]))
        self.assertAlmostEqual(grid['values'][0], expected['receivers'][0]['level_db'])

    def test_bad_inputs(self):
        cases = [dict(cloud_cover=-1), dict(cloud_cover=1.5),
                 dict(sources=[dict(id='s', type_id='missing', lat=0, lng=0)]),
                 dict(receivers=[dict(id='r', lat=float('nan'), lng=0)]),
                 dict(receivers=[dict(id='r', lat=86, lng=0)]),
                 dict(bounds=dict(south=1, north=0, east=1, west=0)),
                 dict(types=[dict(id='t', name='   ', lwa=100)]),
                 dict(types=[dict(id='t', name='x', lwa=float('inf'))]),
                 dict(sources=[dict(id='s', type_id='t', lat=0, lng=0)] * 2)]
        for case in cases:
            with self.subTest(case=case), self.assertRaises(ValidationError):
                self.scenario(**case)


if __name__ == '__main__':
    unittest.main()
