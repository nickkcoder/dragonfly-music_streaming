const pool = require('../config/db');

let schemaPromise = null;

async function loadSchema() {
    const dbName = process.env.DB_NAME || 'dragonflydb';
    const [rows] = await pool.query(
        `SELECT TABLE_NAME, COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ?
           AND TABLE_NAME IN ('Artist', 'artist', 'artists', 'genres', 'songs')`,
        [dbName]
    );

    const columnsByTable = new Map();
    for (const row of rows) {
        if (!columnsByTable.has(row.TABLE_NAME)) {
            columnsByTable.set(row.TABLE_NAME, new Set());
        }
        columnsByTable.get(row.TABLE_NAME).add(row.COLUMN_NAME);
    }

    const artistCandidates = ['Artist', 'artist', 'artists'];
    let artist = null;
    for (const tableName of artistCandidates) {
        const cols = columnsByTable.get(tableName);
        if (!cols) continue;
        const idCol = cols.has('artist_id') ? 'artist_id' : (cols.has('id') ? 'id' : null);
        const nameCol = cols.has('artist_name') ? 'artist_name' : (cols.has('name') ? 'name' : null);
        if (idCol && nameCol) {
            artist = { table: tableName, idCol, nameCol };
            break;
        }
    }

    let genre = null;
    const genreCols = columnsByTable.get('genres');
    if (genreCols) {
        const idCol = genreCols.has('genre_id') ? 'genre_id' : (genreCols.has('id') ? 'id' : null);
        const nameCol = genreCols.has('name')
            ? 'name'
            : (genreCols.has('genre_name') ? 'genre_name' : (genreCols.has('genre') ? 'genre' : null));
        if (idCol && nameCol) {
            genre = { table: 'genres', idCol, nameCol };
        }
    }

    const songCols = columnsByTable.get('songs') || new Set();
    const orderBy = songCols.has('uploaded_at')
        ? 's.uploaded_at'
        : (songCols.has('created_at') ? 's.created_at' : 's.song_id');

    return { artist, genre, orderBy };
}

async function getSchema() {
    if (!schemaPromise) {
        schemaPromise = loadSchema().catch((err) => {
            schemaPromise = null;
            throw err;
        });
    }
    return schemaPromise;
}

function clearSongSchemaCache() {
    schemaPromise = null;
}

async function buildSongSelect() {
    const schema = await getSchema();
    const selects = ['s.*'];
    const joins = [];

    if (schema.artist) {
        selects.push(`a.${schema.artist.nameCol} AS artist_name`);
        joins.push(`LEFT JOIN ${schema.artist.table} a ON a.${schema.artist.idCol} = s.artist_id`);
    }

    if (schema.genre) {
        selects.push(`COALESCE(g.${schema.genre.nameCol}, s.genre_id, '') AS genre`);
        joins.push(`LEFT JOIN ${schema.genre.table} g ON g.${schema.genre.idCol} = s.genre_id`);
    } else {
        selects.push(`COALESCE(s.genre_id, '') AS genre`);
    }

    return {
        selectClause: selects.join(', '),
        joins: joins.join('\n'),
        orderBy: schema.orderBy
    };
}

module.exports = {
    buildSongSelect,
    clearSongSchemaCache
};
