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
        console.log('Connection pool started successfully');
        console.log(`Database connected with user: ${dbConfig.user}`);
        console.log(`Connected to: ${dbConfig.connectString}`);
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

// ==========================
// Insert a Post (with FK checks)
// Usage: await insertPost(content, email, aname)
// If Area doesn't exist, it will be auto-inserted with whetherStem = true
// ==========================
async function insertPost(content, email, aname) {
    return await withOracleDB(async (connection) => {
        const userCheck = await connection.execute(
            `SELECT COUNT(*) FROM User WHERE email = :email`,
            [email]
        );
        if (userCheck.rows[0][0] === 0) {
            throw new Error(`User with email "${email}" does not exist.`);
        }

        const areaCheck = await connection.execute(
            `SELECT COUNT(*) FROM Area WHERE aname = :aname`,
            [aname]
        );
        if (areaCheck.rows[0][0] === 0) {
            await connection.execute(
                `INSERT INTO Area (aname, whetherStem) VALUES (:aname, :isStem)`,
                [aname, true]
            );
        }

        const idResult = await connection.execute(`SELECT MAX(poid) FROM Post`);
        const maxPoid = idResult.rows[0][0] || 0;
        const newPoid = maxPoid + 1;

        const now = new Date();
        const timeStr = now.toTimeString().split(" ")[0]; 

        await connection.execute(
            `INSERT INTO Post (poid, content, time, email, aname)
             VALUES (:poid, :content, TO_TIMESTAMP(:time, 'HH24:MI:SS'), :email, :aname)`,
            [newPoid, content, timeStr, email, aname],
            { autoCommit: true }
        );

        return true;
    }).catch((err) => {
        console.error(err.message);
        return false;
    });
}

// ==========================
// List all posts
// Usage: await listPosts()
// Returns an array of all post records
// ==========================
async function listPosts() {
    return await withOracleDB(async (connection) => {
        const result = await connection.execute(
            `SELECT poid, content, TO_CHAR(time, 'HH24:MI:SS') AS time, email, aname
             FROM Post
             ORDER BY poid`
        );
        return result.rows;
    }).catch((err) => {
        console.error(err.message);
        return [];
    });
}

// ==========================
// Update a Post (partial updates supported)
// Usage: await updatePost(poid, { content, time, email, aname })
// If updated email or aname doesn't exist, it throws an error
// ==========================
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

// ==========================
// Delete an Author (cascade delete Wrote entries)
// Usage: await deleteAuthorCascade(aid)
// If author doesn't exist, returns false
// ==========================
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

// ==========================
// Select Papers by Conditions (with AND/OR logic)
// Usage: await selectPapers([
//   { attribute: "aname", operator: "=", value: "AI", logic: "AND" },
//   { attribute: "publishedDate", operator: ">", value: "2023-01-01", logic: "" }
// ])
// ==========================
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

// ==========================
// Project Author Attributes
// Usage: await projectAuthor(["name", "instituteName"])
// Only returns specified fields from Author
// ==========================
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

// ==========================
// Aggregation: Count papers per area
// Usage: await countPapersPerArea()
// Returns [aname, paper_count] pairs
// ==========================
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

// ==========================
// Aggregation with HAVING: Get users with ≥ minPosts
// Usage: await getUsersWithMinPosts(3)
// Returns emails of users meeting threshold
// ==========================
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


// ==========================
// Nested Aggregation with Group By
// Usage: await getTopAuthorsPerArea()
// Returns authors whose publication count in an area is above area average
// ==========================
async function getTopAuthorsPerArea() {
    return await withOracleDB(async (connection) => {
        const result = await connection.execute(
            `SELECT A.name, P.aname, COUNT(*) AS num_papers
             FROM Author A
             JOIN Wrote W ON A.aid = W.aid
             JOIN Paper P ON W.pid = P.pid
             GROUP BY A.name, P.aname
             HAVING COUNT(*) > (
                SELECT AVG(sub.count_per_author)
                FROM (
                    SELECT COUNT(*) AS count_per_author
                    FROM Author A2
                    JOIN Wrote W2 ON A2.aid = W2.aid
                    JOIN Paper P2 ON W2.pid = P2.pid
                    WHERE P2.aname = P.aname
                    GROUP BY A2.name
                ) sub
             )`
        );
        return result.rows;
    }).catch((err) => {
        console.error(err.message);
        return [];
    });
}

// ==========================
// Division Query: Users who posted in ALL areas
// Usage: await getUsersPostedInAllAreas()
// Returns emails of users who posted in every Area
// ==========================
async function getUsersPostedInAllAreas() {
    return await withOracleDB(async (connection) => {
        const result = await connection.execute(
            `SELECT U.email
             FROM User U
             WHERE NOT EXISTS (
                 SELECT A.aname
                 FROM Area A
                 WHERE NOT EXISTS (
                     SELECT 1
                     FROM Post P
                     WHERE P.aname = A.aname AND P.email = U.email
                 )
             )`
        );
        return result.rows;
    }).catch((err) => {
        console.error(err.message);
        return [];
    });
}

// new functions
async function loginUser(email) {
    console.log('Email value:', email);
    console.log('Type of email:', typeof email); // 应该输出 "string"

    try {
        return await withOracleDB(async (connection) => {
            const result = await connection.execute(
                `SELECT name FROM USERS WHERE email = :email`,
                [email]
            );
            console.log('login query result:', result.rows);
            if (result.rows.length > 0) {
                return result.rows.map(row => row[0]);
            } else {
                return [];
            }
        });
    } catch (err) {
        console.error('Login failed:', err.message);
        return [];
    }
}

async function registerUser(email, name) {
    rid = null;
    try {
        return await withOracleDB(async (connection) => {
            // Check if the user already exists
            const userCheck = await connection.execute(
                `SELECT COUNT(*) FROM Users WHERE email = :email`,
                [email]
            );
            if (userCheck.rows[0][0] > 0) {
                return false;
            }
            // Insert new user
            await connection.execute(
                `INSERT INTO Users (email, name, rid) VALUES (:email, :name, :rid)`,
                [email, name, rid],
                { autoCommit: true }
            );
            return true;
        });
    } catch (err) {
        console.error('Registration failed:', err.message);
        return false;
    }
}
//
module.exports = {
    testOracleConnection,
    // listPosts,
    // listPostComments,
    // listPapers,
    insertPost,
    updatePost, 
    // deletePost,
    deleteAuthorCascade,
    selectPapers,
    projectAuthor,
    findAuthorsByArea,
    countPapersPerArea,
    getUsersWithMinPosts,
    getTopAuthorsPerArea,
    getUsersPostedInAllAreas,
    loginUser,
    registerUser
};