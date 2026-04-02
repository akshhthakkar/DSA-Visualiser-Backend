import { prisma } from '../src/config/database.js';

async function main() {
    console.log("Updating Two Sum expected output...");
    const problem = await prisma.problem.findFirst({ where: { title: 'Two Sum' } });
    
    if (problem) {
        console.log("Current expected output:", problem.expectedOutput);
        
        await prisma.problem.update({
            where: { id: problem.id },
            data: {
                expectedOutput: {
                    javascript: '[0,1]\n[1,2]',
                    python: '[0, 1]\n[1, 2]',
                    java: '[0, 1]\n[1, 2]',
                    cpp: '[0, 1]\n[1, 2]'
                }
            }
        });
        console.log("Successfully updated Two Sum expected output to match multiple test cases!");
    } else {
        console.log("Two Sum not found.");
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
