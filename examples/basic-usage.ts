/**
 * Basic Usage Example for @mvsep/node
 * 
 * This example demonstrates how to:
 * 1. Initialize the client
 * 2. Create a separation job
 * 3. Poll for completion
 * 4. Download results
 */

import { MVSEPClient, Algorithm, SeparationHistoryItem, SeparationStatus, SeparationData, SeparatedFile } from '../src';
import fs from 'fs';
import https from 'https';
import path from 'path';

// Initialize client with your API token
const client = new MVSEPClient({
  apiToken: process.env.MVSEP_API_TOKEN || 'your-api-token-here',
  debug: true // Enable debug logging
});

/**
 * Helper function to download files
 */
async function downloadFile(url: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded: ${outputPath}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {});
      reject(err);
    });
  });
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('🎵 MVSEP Audio Separation Example\n');

    // Step 1: Get available algorithms
    console.log('📋 Fetching available algorithms...');
    const algorithms = await client.getAlgorithms();
    console.log(`Found ${algorithms.length} algorithms\n`);

    // Show some popular algorithms
    const popular = algorithms.filter((a: Algorithm) => a.is_active === 1).slice(0, 5);
    console.log('Popular algorithms:');
    popular.forEach((algo: Algorithm) => {
      console.log(`  ${algo.id}: ${algo.name}`);
    });
    console.log();

    // Step 2: Create separation job
    console.log('🚀 Creating separation job...');
    const audioPath = process.argv[2] || './song.mp3';
    
    if (!fs.existsSync(audioPath)) {
      console.error(`Error: Audio file not found at ${audioPath}`);
      console.log('Usage: ts-node examples/basic-usage.ts <path-to-audio-file>');
      process.exit(1);
    }

    const result = await client.createAndWaitForSeparation({
      audiofile: fs.createReadStream(audioPath),
      sep_type: 25 // MDX23C algorithm (vocals/instrumental)
    }, {
      interval: 3000, // Poll every 3 seconds
      onProgress: (status: SeparationStatus) => {
        if (status.data && 'queue_count' in status.data) {
          console.log(`  Queue position: ${status.data.current_order}/${status.data.queue_count}`);
        } else {
          console.log(`  Status: ${status.status}`);
        }
      }
    });

    console.log('\n✅ Separation complete!\n');

    // Step 3: Display results
    const separationData = result.data as SeparationData;
    console.log('📊 Results:');
    console.log(`  Algorithm: ${separationData.algorithm}`);
    console.log(`  Size: ${separationData.size}`);
    console.log(`  Format: ${separationData.output_format}\n`);

    console.log('🎼 Separated stems:');
    separationData.files.forEach((file: SeparatedFile) => {
      console.log(`  ${file.stem || 'unknown'}: ${file.size}`);
      console.log(`    URL: ${file.url}`);
    });
    console.log();

    // Step 4: Download files (optional)
    const shouldDownload = process.env.AUTO_DOWNLOAD === 'true';
    
    if (shouldDownload) {
      console.log('⬇️  Downloading files...');
      const outputDir = './output';
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      for (const file of separationData.files) {
        const filename = `${file.stem || 'output'}.mp3`;
        const outputPath = path.join(outputDir, filename);
        await downloadFile(file.url, outputPath);
        console.log(`Downloaded: ${file.stem}`);
      }

      console.log(`\n✅ All files downloaded to ${outputDir}/`);
    } else {
      console.log('💡 Tip: Set AUTO_DOWNLOAD=true to automatically download files');
    }

    // Step 5: Get separation history
    console.log('\n📜 Recent separation history:');
    const history = await client.getSeparationHistory({ limit: 5 });
    history.forEach((item: SeparationHistoryItem, index: number) => {
      console.log(`  ${index + 1}. ${item.algorithm.name}`);
      console.log(`     Created: ${item.created_at}`);
      console.log(`     Credits: ${item.credits}`);
    });

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    
    if (error.status) {
      console.error(`   Status: ${error.status} ${error.statusText}`);
    }
    
    if (error.code) {
      console.error(`   Code: ${error.code}`);
    }

    process.exit(1);
  }
}

// Run the example
main();