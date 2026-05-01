import fs from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

type CliArgs = {
  inputPath: string;
  outputPath: string | null;
  model: string;
};

function usage(): string {
  return [
    'Usage:',
    '  node --import tsx scripts/transcribeAudio.ts "<audio-file-path>" [--out <output-txt-path>] [--model <model>]',
    '',
    'Examples:',
    '  node --import tsx scripts/transcribeAudio.ts "Call with TRI-TWO.m4a"',
    '  node --import tsx scripts/transcribeAudio.ts "/absolute/path/Call with TRI-TWO.m4a" --out "/tmp/call1.txt"',
  ].join('\n');
}

function parseArgs(argv: string[]): CliArgs {
  const rest = argv.slice(2);
  const inputPath = rest[0];
  if (!inputPath || inputPath === '--help' || inputPath === '-h') {
    throw new Error(usage());
  }

  let outputPath: string | null = null;
  let model = 'gpt-4o-mini-transcribe';

  for (let i = 1; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--out') {
      outputPath = rest[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === '--model') {
      model = rest[i + 1] ?? model;
      i += 1;
      continue;
    }
  }

  return { inputPath, outputPath, model };
}

async function main() {
  const args = parseArgs(process.argv);
  const resolvedInput = path.resolve(args.inputPath);

  if (!fs.existsSync(resolvedInput)) {
    throw new Error(`Audio file not found: ${resolvedInput}`);
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required in environment (.env or .env.local).');
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const result = await client.audio.transcriptions.create({
    file: fs.createReadStream(resolvedInput),
    model: args.model,
    response_format: 'text',
  });

  const text = String(result ?? '').trim();
  const outPath =
    args.outputPath != null
      ? path.resolve(args.outputPath)
      : path.join(path.dirname(resolvedInput), `${path.basename(resolvedInput, path.extname(resolvedInput))}.transcript.txt`);

  fs.writeFileSync(outPath, `${text}\n`, 'utf8');

  console.info('Transcription complete', {
    input: resolvedInput,
    output: outPath,
    model: args.model,
    chars: text.length,
  });
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('transcribeAudio failed:', message);
  process.exitCode = 1;
});
