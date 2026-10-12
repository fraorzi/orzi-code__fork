import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("installer", Path(__file__).resolve().parent.parent / "resources/local-update/install.py")
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(prefix="orzi-installer-")
        self.root = Path(self.scratch.name)
        self.profile = self.root / "profile"
        self.profile.mkdir()
        (self.profile / "settings.json").write_text("original")
        self.target = self.bundle("installed/Orzi Code.app", "old")
        self.source = self.bundle("source/Orzi Code.app", "new")
        installer.stage(self.source, self.profile)
        self.manifest = json.loads((self.profile / "local-updates/ready.json").read_text())

    def tearDown(self):
        self.scratch.cleanup()

    def bundle(self, name, contents):
        bundle = self.root / name
        (bundle / "Contents/MacOS").mkdir(parents=True)
        (bundle / "Contents/Resources").mkdir()
        shutil.copy("/usr/bin/true", bundle / "Contents/MacOS/App")
        (bundle / "Contents/Resources/app.asar").write_text(contents)
        (bundle / "Contents/Info.plist").write_text('<plist version="1.0"><dict><key>CFBundleIdentifier</key><string>com.franciszek.poracode.personal</string><key>CFBundleExecutable</key><string>App</string><key>CFBundleShortVersionString</key><string>1.8.1</string></dict></plist>')
        subprocess.run(["/usr/bin/codesign", "--force", "--deep", "--sign", "-", str(bundle)], check=True, capture_output=True)
        return bundle

    def test_installs_real_signed_files_and_keeps_backup(self):
        actual_run = installer.run

        def launch(*args):
            if args[0] == "/usr/bin/open":
                self.assertIn("PORACODE_BASE_DIR=" + str(self.profile), args)
                installer.atomic_json(self.profile / "local-updates/started.json", {"sha256": installer.digest(self.target), "pid": 1})
                return ""
            return actual_run(*args)

        with patch.object(installer, "run", launch), patch.object(installer, "wait_for_exit"), patch.object(installer, "processes", return_value={}):
            installer.install(self.profile, self.target, 1, self.manifest["sha256"])
        self.assertEqual(installer.digest(self.target), self.manifest["sha256"])
        self.assertEqual((self.profile / "settings.json").read_text(), "original")
        report = json.loads((self.profile / "local-updates/result.json").read_text())
        self.assertEqual(report["status"], "installed")
        self.assertEqual((Path(report["backup"]) / "Orzi Code.app/Contents/Resources/app.asar").read_text(), "old")

    def test_rolls_back_bundle_and_profile_after_launch_failure(self):
        actual_run = installer.run
        launched = 0

        def launch(*args):
            nonlocal launched
            if args[0] == "/usr/bin/open":
                launched += 1
                if launched == 1:
                    (self.profile / "settings.json").write_text("modified during failed start")
                    raise RuntimeError("injected launch failure")
                return ""
            return actual_run(*args)

        with patch.object(installer, "run", launch), patch.object(installer, "wait_for_exit"), patch.object(installer, "processes", return_value={}):
            with self.assertRaisesRegex(RuntimeError, "injected launch failure"):
                installer.install(self.profile, self.target, 1, self.manifest["sha256"])
        self.assertEqual((self.target / "Contents/Resources/app.asar").read_text(), "old")
        self.assertEqual((self.profile / "settings.json").read_text(), "original")
        self.assertEqual(launched, 2)

    def test_corruption_leaves_current_app_and_profile_untouched(self):
        staged = Path(self.manifest["bundlePath"])
        (staged / "Contents/Resources/app.asar").write_text("corrupt")
        with self.assertRaises((RuntimeError, subprocess.CalledProcessError)):
            installer.install(self.profile, self.target, 1, self.manifest["sha256"])
        self.assertEqual((self.target / "Contents/Resources/app.asar").read_text(), "old")
        self.assertEqual((self.profile / "settings.json").read_text(), "original")


if __name__ == "__main__":
    unittest.main()
