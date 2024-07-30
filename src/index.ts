import { extname } from 'node:path';
import { Transform, PassThrough, type Readable } from 'node:stream';
import { BufferStream } from 'bufferstreams';
import type Vinyl from 'vinyl';
import ttf2woff2 from 'ttf2woff2';
import PluginError from 'plugin-error';
import replaceExtension from 'replace-ext';

const PLUGIN_NAME = 'gulp-ttf2woff2';

export type GulpTTF2WOFF2Options = {
  ignoreExt?: boolean;
  clone?: boolean;
};

// File level transform function
function ttf2woff2Transform() {
  // Return a callback function handling the buffered content
  return function ttf2woff2TransformCb(
    err: Error | null,
    buf: Buffer,
    cb: (err: Error | null, buf?: Buffer) => void,
  ) {
    // Handle any error
    if (err) {
      return cb(
        new PluginError(PLUGIN_NAME, err.message, {
          showStack: true,
        }),
      );
    }

    // Use the buffered content
    try {
      buf = ttf2woff2(Buffer.from(buf));
      return cb(null, buf);
    } catch (err2) {
      return cb(
        new PluginError(
          PLUGIN_NAME,
          (err2 as Error).message,
          {
            showStack: true,
          },
        ),
      );
    }
  };
}

// Plugin function
function ttf2woff2Gulp(options?: GulpTTF2WOFF2Options) {
  const stream = new Transform({ objectMode: true });

  options = options || {};
  options.ignoreExt = options.ignoreExt || false;
  options.clone = options.clone || false;

  stream._transform = function ttf2woff2GulpTransform(file: Vinyl, _, done) {
    let cntStream;
    let newFile;

    // When null just pass through
    if (file.isNull() || file.isDirectory()) {
      stream.push(file);
      done();
      return;
    }

    // If the ext doesn't match, pass it through
    if (!options.ignoreExt && '.ttf' !== extname(file.path)) {
      stream.push(file);
      done();
      return;
    }

    // Fix for the vinyl clone method...
    // https://github.com/wearefractal/vinyl/pull/9
    if (options.clone) {
      if (file.isBuffer()) {
        stream.push(file.clone());
      } else {
        cntStream = file.contents;
        file.contents = null;
        newFile = file.clone();
        file.contents = cntStream.pipe(new PassThrough());
        newFile.contents = (file.contents as Readable).pipe(new PassThrough());
        stream.push(newFile);
      }
    }

    file.path = replaceExtension(file.path, '.woff2');

    // Buffers
    if (file.isBuffer()) {
      try {
        file.contents = ttf2woff2(file.contents);
      } catch (err) {
        stream.emit(
          'error',
          new PluginError(PLUGIN_NAME, (err as Error).message, {
            showStack: true,
          }),
        );
      }

      // Streams
    } else {
      file.contents = (file.contents as Readable).pipe(
        new BufferStream(ttf2woff2Transform()),
      );
    }

    stream.push(file);
    done();
  };

  return stream;
}

// Export the file level transform function for other plugins usage
ttf2woff2Gulp.fileTransform = ttf2woff2Transform;

// Export the plugin main function
export default ttf2woff2Gulp;
