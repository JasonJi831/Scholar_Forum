const oracledb = require('oracledb');
const loadEnvFile = require('./utils/envUtil');

const envVariables = loadEnvFile('./.env');

// Database configuration setup. Ensure your .env file has the required database credentials.
const dbConfig = {
    user: envVariables.ORACLE_USER,
    password: envVariables.ORACLE_PASS,
    connectString: `${envVariables.ORACLE_HOST}:${envVariables.ORACLE_PORT}/${envVariables.ORACLE_DBNAME}`,
    poolMin: 1,
    poolMax: 3,
    poolIncrement: 1,
    poolTimeout: 60
};

// initialize connection pool
async function initializeConnectionPool() {
    try {
        await oracledb.createPool(dbConfig);
        console.log('Connection pool started');
    } catch (err) {
        console.error('Initialization error: ' + err.message);
    }
}

async function closePoolAndExit() {
    console.log('\nTerminating');
    try {
        await oracledb.getPool().close(10); // 10 seconds grace period for connections to finish
        console.log('Pool closed');
        process.exit(0);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
}

initializeConnectionPool();

process
    .once('SIGTERM', closePoolAndExit)
    .once('SIGINT', closePoolAndExit);


// ----------------------------------------------------------
// Wrapper to manage OracleDB actions, simplifying connection handling.
async function withOracleDB(action) {
    let connection;
    try {
        connection = await oracledb.getConnection(); // Gets a connection from the default pool 
        return await action(connection);
    } catch (err) {
        console.error(err);
        throw err;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
}


// ----------------------------------------------------------
// Core functions for database operations
// Modify these functions, especially the SQL queries, based on your project's requirements and design.
async function testOracleConnection() {
    return await withOracleDB(async (connection) => {
        return true;
    }).catch(() => {
        return false;
    });
}

async function insertPost(poid, content, time, email, aname) {
    return await withOracleDB(async (connection) => {
        // Step 1: Check if email exists in User
        const userCheck = await connection.execute(
            `SELECT COUNT(*) FROM User WHERE email = :email`,
            [email]
        );
        if (userCheck.rows[0][0] === 0) {
            throw new Error(`User with email "${email}" does not exist.`);
        }

        // Step 2: Check if Area exists
        const areaCheck = await connection.execute(
            `SELECT COUNT(*) FROM Area WHERE aname = :aname`,
            [aname]
        );
        if (areaCheck.rows[0][0] === 0) {
            // Optional: insert the Area if not exists
            await connection.execute(
                `INSERT INTO Area (aname, whetherStem) VALUES (:aname, :isStem)`,
                [aname, true]  // Stem is TRUE by defult
            );
        }

        // Step 3: Insert into Post
        await connection.execute(
            `INSERT INTO Post (poid, content, time, email, aname)
             VALUES (:poid, :content, TO_TIMESTAMP(:time, 'HH24:MI:SS'), :email, :aname)`,
            [poid, content, time, email, aname],
            { autoCommit: true }
        );

        return true;
    }).catch((err) => {
        console.error(err.message);
        return false;
    });
}

async function updatePost(poid, updatedFields) {
    return await withOracleDB(async (connection) => {
        const setClauses = [];
        const bindParams = { poid };

        if (updatedFields.content !== undefined) {
            setClauses.push("content = :content");
            bindParams.content = updatedFields.content;
        }

        if (updatedFields.time !== undefined) {
            setClauses.push("time = TO_TIMESTAMP(:time, 'HH24:MI:SS')");
            bindParams.time = updatedFields.time;
        }

        if (updatedFields.email !== undefined) {
            const userCheck = await connection.execute(
                `SELECT COUNT(*) FROM User WHERE email = :email`,
                [updatedFields.email]
            );
            if (userCheck.rows[0][0] === 0) {
                throw new Error(`User with email "${updatedFields.email}" does not exist.`);
            }
            setClauses.push("email = :email");
            bindParams.email = updatedFields.email;
        }

        if (updatedFields.aname !== undefined) {
            const areaCheck = await connection.execute(
                `SELECT COUNT(*) FROM Area WHERE aname = :aname`,
                [updatedFields.aname]
            );
            if (areaCheck.rows[0][0] === 0) {
                throw new Error(`Area "${updatedFields.aname}" does not exist. Cannot update Post.`);
            }
            setClauses.push("aname = :aname");
            bindParams.aname = updatedFields.aname;
        }

        if (setClauses.length === 0) {
            throw new Error("No fields provided to update.");
        }

        const sql = `UPDATE Post SET ${setClauses.join(", ")} WHERE poid = :poid`;
        const result = await connection.execute(sql, bindParams, { autoCommit: true });

        return result.rowsAffected > 0;
    }).catch((err) => {
        console.error(err.message);
        return false;
    });
}

async function deleteAuthorCascade(aid) {
    return await withOracleDB(async (connection) => {
        const authorCheck = await connection.execute(
            `SELECT COUNT(*) FROM Author WHERE aid = :aid`,
            [aid]
        );
        if (authorCheck.rows[0][0] === 0) {
            console.warn(`Author with aid ${aid} does not exist.`);
            return false;
        }

        await connection.execute(
            `DELETE FROM Wrote WHERE aid = :aid`,
            [aid]
        );

        const result = await connection.execute(
            `DELETE FROM Author WHERE aid = :aid`,
            [aid],
            { autoCommit: true }
        );

        return result.rowsAffected > 0;
    }).catch((err) => {
        console.error(err.message);
        return false;
    });
}

async function selectPapers(conditions) {
    return await withOracleDB(async (connection) => {
        let sql = "SELECT * FROM Paper";
        const whereClauses = [];
        const bindParams = {};

        for (let i = 0; i < conditions.length; i++) {
            const { attribute, operator, value, logic } = conditions[i];
            const paramKey = `v${i}`; 

            if (!["aname", "publishedDate", "title"].includes(attribute)) {
                throw new Error(`Unsupported attribute: ${attribute}`);
            }

            let conditionStr = "";
            if (attribute === "publishedDate") {
                conditionStr = `${attribute} ${operator} TO_DATE(:${paramKey}, 'YYYY-MM-DD')`;
            } else {
                conditionStr = `${attribute} ${operator} :${paramKey}`;
            }

            if (i > 0 && logic) {
                whereClauses.push(`${logic} ${conditionStr}`);
            } else {
                whereClauses.push(conditionStr);
            }

            bindParams[paramKey] = value;
        }

        if (whereClauses.length > 0) {
            sql += " WHERE " + whereClauses.join(" ");
        }

        const result = await connection.execute(sql, bindParams);
        return result.rows;
    }).catch((err) => {
        console.error(err.message);
        return [];
    });
}

async function projectAuthor(attributes) {
    return await withOracleDB(async (connection) => {
        const validAttributes = ["aid", "name", "instituteName", "address"];
        
        const selectedAttrs = attributes.filter(attr => validAttributes.includes(attr));
        if (selectedAttrs.length === 0) {
            throw new Error("No valid attributes provided for projection.");
        }

        const sql = `SELECT ${selectedAttrs.join(", ")} FROM Author`;
        const result = await connection.execute(sql);
        return result.rows;
    }).catch((err) => {
        console.error(err.message);
        return [];
    });
}

async function findAuthorsByArea(aname) {
    return await withOracleDB(async (connection) => {
        const result = await connection.execute(
            `SELECT A.name, P.title
             FROM Author A
             JOIN Wrote W ON A.aid = W.aid
             JOIN Paper P ON W.pid = P.pid
             WHERE P.aname = :aname`,
            [aname]
        );
        return result.rows;
    }).catch((err) => {
        console.error(err.message);
        return [];
    });
}

async function countPapersPerArea() {
    return await withOracleDB(async (connection) => {
        const result = await connection.execute(
            `SELECT aname, COUNT(*) AS paper_count
             FROM Paper
             GROUP BY aname`
        );
        return result.rows;
    }).catch((err) => {
        console.error(err.message);
        return [];
    });
}

async function getUsersWithMinPosts(minPosts) {
    return await withOracleDB(async (connection) => {
        const result = await connection.execute(
            `SELECT email
             FROM Post
             GROUP BY email
             HAVING COUNT(*) >= :minPosts`,
            [minPosts]
        );
        return result.rows;
    }).catch((err) => {
        console.error(err.message);
        return [];
    });
}






module.exports = {
    testOracleConnection,
    insertPost,
    updatePost,
    deleteAuthorCascade,
    selectPapers,
    projectAuthor,
    findAuthorsByArea,
    countPapersPerArea,
    getUsersWithMinPosts
};