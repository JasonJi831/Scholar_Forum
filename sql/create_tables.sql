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