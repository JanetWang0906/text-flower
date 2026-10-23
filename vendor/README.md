# Local QR libraries

These libraries are shipped with the app and make no network requests at runtime.

- `qrcode.js`: [qrcode-generator 1.4.4](https://github.com/kazuhikoarase/qrcode-generator), Copyright 2009 Kazuhiko Arase, MIT; full license in `qrcode-LICENSE.txt`.
- `jsQR.js`: [jsQR 1.4.0](https://github.com/cozmo/jsQR), Apache-2.0; full license in `jsQR-LICENSE.txt`.

Downloaded from the versioned npm registry tarballs; SHA-512 tarball integrity was verified against registry metadata. Files are unmodified. `gift-codec.js` sets the generator's bundled UTF-8 encoder for Chinese and emoji. Each implementation owns its local copy; the mini-tool builder reads only `minitool-src/`.

Package sources, verified tarball integrity, and per-file SHA-256 are recorded in `versions.json`.

`licenses.json` also includes both full license texts so the offline ZIP retains them when packaging only supported asset extensions.
