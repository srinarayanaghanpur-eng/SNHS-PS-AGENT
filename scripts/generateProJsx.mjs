#!/usr/bin/env node
// Generates 6 candidate JSX files from the pro design engine for visual inspection in Photoshop.
// Run: node scripts/generateProJsx.mjs [--outDir ./test-pro-output]

import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const require = createRequire(import.meta.url);

// We need to use the TypeScript source via tsx or esbuild
// Since the pro modules are in TypeScript, use esbuild to bundle on the fly
import esbuild from 'esbuild';

const outDir = resolve(process.argv[2] || './test-pro-output');

async function main() {
  await mkdir(outDir, { recursive: true });

  // Build a bundle of the pro pipeline entry
  const result = await esbuild.build({
    entryPoints: [join(__dirname, '..', 'src-v2', 'main', 'design', 'pro', 'orchestrator.ts')],
    bundle: true,
    platform: 'node',
    target: 'es2022',
    format: 'esm',
    external: ['electron', 'sharp'],
    write: false,
    outdir: outDir,
  });

  const code = result.outputFiles?.[0]?.text;
  if (!code) throw new Error('Bundle produced no output');

  // Evaluate the bundle in a sandbox
  const blob = `data:text/javascript,${encodeURIComponent(code)}`;
  const { runProDesignPipeline, legacyToContentInput } = await import(blob);

  const { detectInstalledFonts, getBestPairingForFamily } = await import(join(__dirname, '..', 'src-v2', 'main', 'design', 'pro', 'typography.ts'));

  const contentInput = {
    school: {
      name: 'SRI NARAYANA HIGH SCHOOL',
      address: 'Ghanpur (M), Jayashankar Bhupalpally District',
      phone: '6300038389',
      academicYear: 'Academic Year 2026\u201327',
    },
    headline: 'Morning Prayer Assembly',
    subheadline: 'A meaningful start to every day',
    message: 'Students gathered for prayer, reflection and a positive beginning.',
    details: 'Monday, 21 July 2026',
    venue: 'School Auditorium',
    programme: [
      'Prayer Song', 'Pledge', 'Thought for the Day', 'News Headlines',
      'Word of the Day', 'Quiz Question', 'Birthday Wishes',
      'Principal\u2019s Message', 'National Anthem',
    ],
    leadBranding: 'Powered by LEAD Curriculum',
    management: {
      chairman: { show: true, name: 'Sri K. Narayana', designation: 'Chairman' },
      principal: { show: true, name: 'Dr. S. Rao', designation: 'Principal' },
    },
  };

  const pipelineInput = {
    width: 1080,
    height: 1350,
    content: contentInput,
    primaryColor: '#1E3A5F',
    photoPaths: [],
    outputDir: outDir,
  };

  console.log('Running pro design pipeline...');
  const output = await runProDesignPipeline(pipelineInput);
  console.log(`Pipeline complete. Score: ${output.selectedCandidate.qualityScore.overall}`);

  // Generate JSX from the scene graph
  const { emitJsxFromSceneGraph } = await import(join(__dirname, '..', 'src-v2', 'main', 'design', 'pro', 'jsxEmitterPro.ts'));
  const jsx = emitJsxFromSceneGraph(output.finalSceneGraph, {
    outputDir: outDir,
    exportPng: true,
    exportJpg: true,
    docName: 'SNHS_Pro_Poster_v1',
  });

  const jsxFile = join(outDir, 'SNHS_Pro_Poster_v1.jsx');
  await writeFile(jsxFile, jsx, 'utf8');

  // Write summary
  const summary = {
    pipeline: 'pro-design-engine',
    score: output.selectedCandidate.qualityScore,
    totalNodes: countNodes(output.finalSceneGraph.root),
    candidates: output.candidates.map(c => ({
      id: c.id,
      family: c.family,
      score: c.qualityScore.overall,
    })),
    jsxFile,
    jsxSize: jsx.length,
    instructions: 'Open Adobe Photoshop, go to File > Scripts > Browse, and select the .jsx file.',
  };

  await writeFile(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  console.log(`\nOutput written to ${outDir}`);
  console.log(`JSX file: ${jsxFile} (${(jsx.length / 1024).toFixed(1)} KB)`);
  console.log(`\nTo test in Photoshop:`);
  console.log(`  1. Open Adobe Photoshop`);
  console.log(`  2. File > Scripts > Browse...`);
  console.log(`  3. Select: ${jsxFile}`);
  console.log(`  4. Check ${outDir}/ for the generated PSD/PNG/JPG files`);
}

function countNodes(node) {
  let count = 1;
  if (node.children) {
    for (const child of node.children) {
      count += countNodes(child);
    }
  }
  return count;
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
