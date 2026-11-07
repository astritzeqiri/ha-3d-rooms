"""Climate mapping is typed; native HA handles actual HVAC capabilities."""
import unittest
from test_models import models, package
from io import BytesIO
import zipfile,json
class ClimateTests(unittest.TestCase):
    def test_manifest_and_bindings(self):
        with zipfile.ZipFile(BytesIO(package())) as z:
            manifest=json.loads(z.read('manifest.json'))
        control={'id':'living-ac','label':'Living AC','type':'climate','position':[0,2,0],'capabilities':['more_info'],'nodeIds':['ac']}
        manifest['controls']=[control]
        self.assertEqual(models.validate_manifest(manifest)['controls'][0]['type'],'climate')
        self.assertTrue(models.compatible_entity(control,'climate.living'))
        for entity in ['light.ac','switch.ac','cover.ac','number.ac']:
            self.assertFalse(models.compatible_entity(control,entity))
        for caps in [['on_off'],['set_temperature'],['more_info','brightness']]:
            with self.assertRaises(ValueError):
                models.validate_manifest({**manifest,'controls':[{**control,'capabilities':caps}]})
