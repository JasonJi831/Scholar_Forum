-- Step 1: Drop existing tables if they exist
BEGIN
    FOR rec IN (SELECT object_name, object_type 
                FROM user_objects 
                WHERE object_type IN ('TABLE', 'VIEW', 'SEQUENCE', 'INDEX') 
                  AND object_name IN ('LIKEDBY', 'WROTE', 'AUTHOR', 'INSTITUTE', 'PAPER', 'AREA', 'INCLUDES', 'POST', 
                                      'USERGROUPMEMBERSHIP', 'USERGROUP', 'PARTOF', 'ORGANIZATION', 'READINGLIST', 
                                      'MANAGER', 'USERS', 'COMMENTS')) 
    LOOP
        EXECUTE IMMEDIATE 'DROP ' || rec.object_type || ' ' || rec.object_name || ' CASCADE CONSTRAINTS';
    END LOOP;
END;
/

-- Step 2: Create tables in the correct order

-- Independent tables first
CREATE TABLE Area (
    aname VARCHAR2(100) PRIMARY KEY,
    whetherStem NUMBER(1) CHECK (whetherStem IN (0, 1))
);

CREATE TABLE ReadingList (
    rid INTEGER PRIMARY KEY,
    creationTime DATE
);

CREATE TABLE Users (
    email VARCHAR2(100) PRIMARY KEY,
    name VARCHAR2(100),
    rid INTEGER UNIQUE,
    FOREIGN KEY (rid) REFERENCES ReadingList(rid) ON DELETE SET NULL
);

CREATE TABLE Manager (
    email VARCHAR2(100) PRIMARY KEY,
    FOREIGN KEY (email) REFERENCES Users(email) ON DELETE CASCADE
);

CREATE TABLE Organization (
    oid INTEGER PRIMARY KEY,
    name VARCHAR2(100)
);

CREATE TABLE UserGroup (
    gid INTEGER PRIMARY KEY,
    name VARCHAR2(100)
);

-- Dependent tables
CREATE TABLE PartOf (
    email VARCHAR2(100),
    oid INTEGER,
    PRIMARY KEY (email, oid),
    FOREIGN KEY (email) REFERENCES Users(email) ON DELETE CASCADE,
    FOREIGN KEY (oid) REFERENCES Organization(oid) ON DELETE CASCADE
);

CREATE TABLE UserGroupMembership (
    gid INTEGER,
    email VARCHAR2(100),
    PRIMARY KEY (gid, email),
    FOREIGN KEY (gid) REFERENCES UserGroup(gid) ON DELETE CASCADE,
    FOREIGN KEY (email) REFERENCES Users(email) ON DELETE CASCADE
);

CREATE TABLE Post (
    poid INTEGER PRIMARY KEY,
    content VARCHAR2(1000),
    time TIMESTAMP,
    email VARCHAR2(100) NOT NULL,
    aname VARCHAR2(100) NOT NULL,
    FOREIGN KEY (email) REFERENCES Users(email) ON DELETE CASCADE,
    FOREIGN KEY (aname) REFERENCES Area(aname) ON DELETE CASCADE
);

CREATE TABLE Includes (
    rid INTEGER,
    poid INTEGER,
    PRIMARY KEY (rid, poid),
    FOREIGN KEY (rid) REFERENCES ReadingList(rid) ON DELETE CASCADE,
    FOREIGN KEY (poid) REFERENCES Post(poid) ON DELETE CASCADE
);

CREATE TABLE Institute (
    instituteName VARCHAR2(100) PRIMARY KEY,
    address VARCHAR2(200)
);

CREATE TABLE Author (
    aid INTEGER PRIMARY KEY,
    name VARCHAR2(100),
    instituteName VARCHAR2(100) NOT NULL,
    FOREIGN KEY (instituteName) REFERENCES Institute(instituteName) ON DELETE CASCADE
);

CREATE TABLE Paper (
    pid INTEGER PRIMARY KEY,
    publishedDate DATE,
    content VARCHAR2(2000),
    aname VARCHAR2(100),
    title VARCHAR2(200),
    FOREIGN KEY (aname) REFERENCES Area(aname) ON DELETE CASCADE
);

CREATE TABLE Wrote (
    aid INTEGER,
    pid INTEGER,
    PRIMARY KEY (aid, pid),
    FOREIGN KEY (aid) REFERENCES Author(aid), -- RESTRICT
    FOREIGN KEY (pid) REFERENCES Paper(pid) ON DELETE CASCADE
);

CREATE TABLE Comments (
    poid INTEGER,
    cid INTEGER,
    email VARCHAR2(100) NOT NULL,
    content VARCHAR2(1000),
    PRIMARY KEY (poid, cid),
    FOREIGN KEY (poid) REFERENCES Post(poid) ON DELETE CASCADE,
    FOREIGN KEY (email) REFERENCES Users(email) ON DELETE CASCADE
);

CREATE TABLE LikedBy (
    poid INTEGER,
    email VARCHAR2(100),
    PRIMARY KEY (poid, email),
    FOREIGN KEY (poid) REFERENCES Post(poid) ON DELETE CASCADE,
    FOREIGN KEY (email) REFERENCES Users(email) ON DELETE CASCADE
);

-- Step 3: Clear existing data before inserting new data
TRUNCATE TABLE LikedBy;
TRUNCATE TABLE Comments;
TRUNCATE TABLE Wrote;
TRUNCATE TABLE Author;
TRUNCATE TABLE Institute;
TRUNCATE TABLE Paper;
TRUNCATE TABLE Area;
TRUNCATE TABLE Includes;
TRUNCATE TABLE Post;
TRUNCATE TABLE UserGroupMembership;
TRUNCATE TABLE UserGroup;
TRUNCATE TABLE PartOf;
TRUNCATE TABLE Organization;
TRUNCATE TABLE ReadingList;
TRUNCATE TABLE Manager;
TRUNCATE TABLE Users;

-- Step 4: Insert data into independent tables first

-- ReadingList table
INSERT INTO ReadingList (rid, creationTime) VALUES (1, TO_DATE('2024-03-01', 'YYYY-MM-DD'));
INSERT INTO ReadingList (rid, creationTime) VALUES (2, TO_DATE('2024-03-02', 'YYYY-MM-DD'));
INSERT INTO ReadingList (rid, creationTime) VALUES (3, TO_DATE('2024-03-03', 'YYYY-MM-DD'));
INSERT INTO ReadingList (rid, creationTime) VALUES (4, TO_DATE('2024-03-04', 'YYYY-MM-DD'));
INSERT INTO ReadingList (rid, creationTime) VALUES (5, TO_DATE('2024-03-05', 'YYYY-MM-DD'));

-- Institute table
INSERT INTO Institute (instituteName, address) VALUES ('MIT', 'Cambridge, MA, USA');
INSERT INTO Institute (instituteName, address) VALUES ('Stanford University', 'Stanford, CA, USA');
INSERT INTO Institute (instituteName, address) VALUES ('Harvard University', 'Cambridge, MA, USA');
INSERT INTO Institute (instituteName, address) VALUES ('Oxford University', 'Oxford, UK');
INSERT INTO Institute (instituteName, address) VALUES ('Tsinghua University', 'Beijing, China');

-- Area table
INSERT INTO Area (aname, whetherStem) VALUES ('Tech', 1);
INSERT INTO Area (aname, whetherStem) VALUES ('Finance', 1);
INSERT INTO Area (aname, whetherStem) VALUES ('Health', 1);
INSERT INTO Area (aname, whetherStem) VALUES ('AI', 1);
INSERT INTO Area (aname, whetherStem) VALUES ('Energy', 1);

-- Organization table
INSERT INTO Organization (oid, name) VALUES (1, 'Tech Innovators Inc.');
INSERT INTO Organization (oid, name) VALUES (2, 'Global Finance Ltd.');
INSERT INTO Organization (oid, name) VALUES (3, 'Health Wellness Co.');
INSERT INTO Organization (oid, name) VALUES (4, 'Green Energy Solutions');
INSERT INTO Organization (oid, name) VALUES (5, 'AI Research Lab');

-- User table
INSERT INTO Users (email, name, rid) VALUES ('alice@example.com', 'Alice', 1);
INSERT INTO Users (email, name, rid) VALUES ('bob@example.com', 'Bob', 2);
INSERT INTO Users (email, name, rid) VALUES ('charlie@example.com', 'Charlie', 3);
INSERT INTO Users (email, name, rid) VALUES ('david@example.com', 'David', 4);
INSERT INTO Users (email, name, rid) VALUES ('eve@example.com', 'Eve', 5);
INSERT INTO Users (email, name, rid) VALUES ('frank@example.com', 'Frank', NULL);
INSERT INTO Users (email, name, rid) VALUES ('grace@example.com', 'Grace', NULL);
INSERT INTO Users (email, name, rid) VALUES ('henry@example.com', 'Henry', NULL);
INSERT INTO Users (email, name, rid) VALUES ('ivy@example.com', 'Ivy', NULL);
INSERT INTO Users (email, name, rid) VALUES ('jack@example.com', 'Jack', NULL);

-- Manager table
INSERT INTO Manager (email) VALUES ('alice@example.com');
INSERT INTO Manager (email) VALUES ('bob@example.com');
INSERT INTO Manager (email) VALUES ('charlie@example.com');
INSERT INTO Manager (email) VALUES ('grace@example.com');
INSERT INTO Manager (email) VALUES ('henry@example.com');

-- PartOf table
INSERT INTO PartOf (email, oid) VALUES ('alice@example.com', 1);
INSERT INTO PartOf (email, oid) VALUES ('bob@example.com', 2);
INSERT INTO PartOf (email, oid) VALUES ('charlie@example.com', 3);
INSERT INTO PartOf (email, oid) VALUES ('david@example.com', 4);
INSERT INTO PartOf (email, oid) VALUES ('eve@example.com', 5);

-- UserGroup table
INSERT INTO UserGroup (gid, name) VALUES (1, 'Data Science Enthusiasts');
INSERT INTO UserGroup (gid, name) VALUES (2, 'Software Developers Hub');
INSERT INTO UserGroup (gid, name) VALUES (3, 'Cybersecurity Experts');
INSERT INTO UserGroup (gid, name) VALUES (4, 'AI Machine Learning Society');
INSERT INTO UserGroup (gid, name) VALUES (5, 'Cloud Computing Innovators');

-- UserGroupMembership table
INSERT INTO UserGroupMembership (gid, email) VALUES (1, 'alice@example.com');
INSERT INTO UserGroupMembership (gid, email) VALUES (2, 'bob@example.com');
INSERT INTO UserGroupMembership (gid, email) VALUES (3, 'charlie@example.com');
INSERT INTO UserGroupMembership (gid, email) VALUES (4, 'david@example.com');
INSERT INTO UserGroupMembership (gid, email) VALUES (5, 'eve@example.com');

-- Post table
INSERT INTO Post (poid, content, time, email, aname) VALUES (101, 'First post in the tech area', SYSTIMESTAMP, 'alice@example.com', 'Tech');
INSERT INTO Post (poid, content, time, email, aname) VALUES (102, 'Financial market trends today', SYSTIMESTAMP, 'bob@example.com', 'Finance');
INSERT INTO Post (poid, content, time, email, aname) VALUES (103, 'Health benefits of regular exercise', SYSTIMESTAMP, 'charlie@example.com', 'Health');
INSERT INTO Post (poid, content, time, email, aname) VALUES (104, 'Latest developments in AI research', SYSTIMESTAMP, 'david@example.com', 'AI');
INSERT INTO Post (poid, content, time, email, aname) VALUES (105, 'Sustainable energy innovations', SYSTIMESTAMP, 'eve@example.com', 'Energy');

-- Includes table
INSERT INTO Includes (rid, poid) VALUES (1, 101);
INSERT INTO Includes (rid, poid) VALUES (2, 102);
INSERT INTO Includes (rid, poid) VALUES (3, 103);
INSERT INTO Includes (rid, poid) VALUES (4, 104);
INSERT INTO Includes (rid, poid) VALUES (5, 105);

-- Paper table
INSERT INTO Paper (pid, publishedDate, content, aname, title) VALUES (1, TO_DATE('2024-01-10', 'YYYY-MM-DD'), 'Exploring AI Ethics', 'AI', 'Ethical AI: Challenges and Opportunities');
INSERT INTO Paper (pid, publishedDate, content, aname, title) VALUES (2, TO_DATE('2024-02-15', 'YYYY-MM-DD'), 'Financial risk analysis techniques', 'Finance', 'Quantitative Risk Assessment');
INSERT INTO Paper (pid, publishedDate, content, aname, title) VALUES (3, TO_DATE('2024-03-20', 'YYYY-MM-DD'), 'Renewable energy advancements', 'Energy', 'The Future of Solar Power');
INSERT INTO Paper (pid, publishedDate, content, aname, title) VALUES (4, TO_DATE('2024-04-05', 'YYYY-MM-DD'), 'Medical innovations and healthcare', 'Health', 'AI in Disease Diagnosis');
INSERT INTO Paper (pid, publishedDate, content, aname, title) VALUES (5, TO_DATE('2024-05-12', 'YYYY-MM-DD'), 'Tech industry growth and trends', 'Tech', 'The Rise of Quantum Computing');

-- Author table
INSERT INTO Author (aid, name, instituteName) VALUES (1, 'Alice Johnson', 'MIT');
INSERT INTO Author (aid, name, instituteName) VALUES (2, 'Bob Smith', 'Stanford University');
INSERT INTO Author (aid, name, instituteName) VALUES (3, 'Charlie Lee', 'Harvard University');
INSERT INTO Author (aid, name, instituteName) VALUES (4, 'David Brown', 'Oxford University');
INSERT INTO Author (aid, name, instituteName) VALUES (5, 'Eve Zhang', 'Tsinghua University');

-- Wrote table
INSERT INTO Wrote (aid, pid) VALUES (1, 1);
INSERT INTO Wrote (aid, pid) VALUES (2, 2);
INSERT INTO Wrote (aid, pid) VALUES (3, 3);
INSERT INTO Wrote (aid, pid) VALUES (4, 4);
INSERT INTO Wrote (aid, pid) VALUES (5, 5);

-- Comments table
INSERT INTO Comments (poid, cid, email, content) VALUES (101, 1, 'alice@example.com', 'Great insights on AI ethics!');
INSERT INTO Comments (poid, cid, email, content) VALUES (102, 2, 'bob@example.com', 'Interesting take on financial risk.');
INSERT INTO Comments (poid, cid, email, content) VALUES (103, 3, 'charlie@example.com', 'Renewable energy is the future!');
INSERT INTO Comments (poid, cid, email, content) VALUES (104, 4, 'david@example.com', 'I appreciate the healthcare analysis.');
INSERT INTO Comments (poid, cid, email, content) VALUES (105, 5, 'eve@example.com', 'Quantum computing is fascinating!');

-- LikedBy table
INSERT INTO LikedBy (poid, email) VALUES (101, 'alice@example.com');
INSERT INTO LikedBy (poid, email) VALUES (102, 'bob@example.com');
INSERT INTO LikedBy (poid, email) VALUES (103, 'charlie@example.com');
INSERT INTO LikedBy (poid, email) VALUES (104, 'david@example.com');
INSERT INTO LikedBy (poid, email) VALUES (105, 'eve@example.com');