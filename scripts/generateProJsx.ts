// Generates pro design engine JSX output for manual Photoshop testing.
// Run: npx tsx scripts/generateProJsx.ts

import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { runProDesignPipeline, legacyToContentInput } from '../src-v2/main/design/pro/orchestrator';
import { emitJsxFromSceneGraph } from '../src-v2/main/design/pro/jsxEmitterPro';
import type { ContentInput } from '../src-v2/main/design/pro/nodeFactory';
import { createStoragePaths } from '../src-v2/main/storage/storagePaths.mjs';

const outDir = resolve(process.argv[2] || join(createStoragePaths().testRuns, `pro-jsx-${Date.now()}`));

async function main() {
  await mkdir(outDir, { recursive: true });

  const contentInput: ContentInput = {
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
  console.log(`Score: ${output.selectedCandidate.qualityScore.overall}`);

  const jsx = emitJsxFromSceneGraph(output.finalSceneGraph, {
    outputDir: outDir,
    exportPng: true,
    exportJpg: true,
    docName: 'SNHS_Pro_Poster_v1',
  });

  const jsxFile = join(outDir, 'SNHS_Pro_Poster_v1.jsx');
  await writeFile(jsxFile, jsx, 'utf8');

  function countNodes(node: any): number {
    let count = 1;
    if (node.children) for (const child of node.children) count += countNodes(child);
    return count;
  }

  const summary = {
    score: output.selectedCandidate.qualityScore,
    totalNodes: countNodes(output.finalSceneGraph.root),
    candidates: output.candidates.map(c => ({ id: c.id, family: c.family, score: c.qualityScore.overall })),
    jsxFile,
    jsxSize: jsx.length,
  };

  await writeFile(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  console.log(`\nOutput: ${outDir}/`);
  console.log(`JSX: ${jsxFile} (${(jsx.length / 1024).toFixed(1)} KB)`);
  console.log(`\nTo test: File > Scripts > Browse > ${jsxFile} in Adobe Photoshop`);
}

main().catch(err => { console.error(err); process.exit(1); });
