// extract.js

// This function validates the environment settings required for the application.
function validateEnvironment() {
    if (!process.env.API_URL) {
        console.error('API_URL is not defined in environment variables.');
        throw new Error('Invalid environment configuration');
    }
}

// Central function to process matches and reduce duplication.
function processMatchesGeneric(matches) {
    const processedStats = [];
    matches.forEach(match => {
        try {
            // Some process logic...
            const stats = getMatchStats(match);
            processedStats.push(stats);
        } catch (error) {
            console.error('Error processing match:', match.id, error);
        }
    });
    return processedStats;
}

// Improved error handling in the original functions
function getAllStatistics(matches) {
    const stats = processMatchesGeneric(matches);
    return stats;
}

function getAllIncidents(matches) {
    const incidents = processMatchesGeneric(matches);
    return incidents;
}

function getAllLineups(matches) {
    const lineups = processMatchesGeneric(matches);
    return lineups;
}

// Adding a final summary of all statistics
function summarizeStatistics(statistics) {
    console.log('Summary of Statistics:', statistics);
}

// Main function to run
function main() {
    validateEnvironment();
    const matches = fetchMatches(); // Assume this function exists and fetches match data
    const stats = getAllStatistics(matches);
    const incidents = getAllIncidents(matches);
    const lineups = getAllLineups(matches);
    summarizeStatistics({stats, incidents, lineups});
}

main();