// utils or index.ts
import * as random from 'random';
import { setTimeout } from 'timers/promises';

/**
 * Pauses execution for a random duration between specified min and max seconds.
 */
export async function pauseExecution(minSeconds = 10, maxSeconds = 30): Promise<void> {
  // Generates a random integer (inclusive) between the min and max values.
  const waitTime = random.int(minSeconds, maxSeconds); 
  console.log(`\n💤 Pausing for ${waitTime} seconds...`);
  
  // Await the timer promise. setTimeout expects milliseconds (1000ms = 1s).
  await setTimeout(waitTime * 1000); 
}