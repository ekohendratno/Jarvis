"""Stream Edge neural MP3 to stdout; input is a JSON object on stdin.

Adapted for interactive Jarvis speech from the user's voiceover example.
No files, subtitles, FFmpeg, shell interpolation, or audio text in process args.
"""
import asyncio
import json
import sys

import edge_tts


async def main():
    request = json.load(sys.stdin)
    speaker = edge_tts.Communicate(
        text=request['text'], voice=request['voice'],
        rate=f"{request['rate']:+d}%", pitch=f"{request['pitch']:+d}Hz",
        volume=f"{request['volume']:+d}%",
    )
    received = False
    async for chunk in speaker.stream():
        if chunk['type'] == 'audio':
            received = True
            sys.stdout.buffer.write(chunk['data'])
            sys.stdout.buffer.flush()
    if not received:
        raise RuntimeError('Edge TTS did not return audio.')


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except (BrokenPipeError, ConnectionResetError):
        sys.exit(0)
    except Exception as error:
        print(f'{type(error).__name__}: {error}', file=sys.stderr)
        sys.exit(1)
