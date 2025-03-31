const express = require('express');
const appService = require('./appService');

const router = express.Router();

// ----------------------------------------------------------
// API endpoints
// Modify or extend these routes based on your project's needs.
router.get('/check-db-connection', async (req, res) => {
    const isConnect = await appService.testOracleConnection();
    if (isConnect) {
        res.send('connected');
    } else {
        res.send('unable to connect');
    }
});

router.get('/demotable', async (req, res) => {
    const tableContent = await appService.fetchDemotableFromDb();
    res.json({data: tableContent});
});

router.post("/initiate-demotable", async (req, res) => {
    const initiateResult = await appService.initiateDemotable();
    if (initiateResult) {
        res.json({ success: true });
    } else {
        res.status(500).json({ success: false });
    }
});

router.post("/insert-demotable", async (req, res) => {
    const { id, name } = req.body;
    const insertResult = await appService.insertDemotable(id, name);
    if (insertResult) {
        res.json({ success: true });
    } else {
        res.status(500).json({ success: false });
    }
});

router.post("/update-name-demotable", async (req, res) => {
    const { oldName, newName } = req.body;
    const updateResult = await appService.updateNameDemotable(oldName, newName);
    if (updateResult) {
        res.json({ success: true });
    } else {
        res.status(500).json({ success: false });
    }
});

router.get('/count-demotable', async (req, res) => {
    const tableCount = await appService.countDemotable();
    if (tableCount >= 0) {
        res.json({ 
            success: true,  
            count: tableCount
        });
    } else {
        res.status(500).json({ 
            success: false, 
            count: tableCount
        });
    }
});

router.get('/user-login', async (req, res) => {
    try {
        const { email } = req.query;

        const user = await appService.loginUser(email);
        console.log('User:', user);
        if (user.length > 0) {
            res.json({ 
                success: true, 
                message: 'User login successful', 
                user: user[0] 
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: 'User not found'
            });
        }
    } catch (err) {
        console.error('Error during user login:', err.message);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error'
        });
    }
});

router.get('/user-register', async (req, res) => {
    // Extract email and name from query parameters
    const { email, name } = req.query;

    // Check if both parameters are provided
    if (!email || !name) {
        return res.status(400).json({ error: 'Missing email or name parameter' });
    }

    try {
        // Attempt to register the user
        const success = await appService.registerUser(email, name);
        if (success) {
            res.json({ message: 'User registered successfully' });
        } else {
            res.status(409).json({ error: 'User registration failed, user may already exist' });
        }
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/post', async (req, res) => {
    const { content, email, aname } = req.body;

    // Validate input
    if (!content || !email || !aname) {
        return res.status(400).json({ error: 'Missing required fields: content, email, aname' });
    }

    try {
        // Attempt to insert the post
        const success = await appService.insertPost(content, email, aname);
        if (success) {
            res.status(201).json({ message: 'Post created successfully' });
        } else {
            res.status(500).json({ error: 'Failed to create post' });
        }
    } catch (err) {
        console.error('Error creating post:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.get('/allPosts', async (req, res) => {
    try {
        const rawPosts = await appService.listPosts();
        console.log("Raw Posts: ", rawPosts);

        const posts = rawPosts.map(post => ({
            id: post[0],         
            content: post[1],    
            time: post[2],       
            email: post[3],     
            aname: post[4]    
        }));

        console.log("Formatted Posts: ", posts);

        if (posts.length > 0) {
            res.status(200).json({ message: 'Posts retrieved successfully', data: posts });
        } else {
            res.status(404).json({ message: 'No posts available' });
        }
    } catch (err) {
        console.error('Error fetching posts:', err.message);
        res.status(500).json({ error: 'Failed to retrieve posts' });
    }
});

router.get('/allAreas', async (req, res) => {
    try {
        const areas = await appService.listAllAreas();
        if (areas.length > 0) {
            res.status(200).json({ message: 'Areas retrieved successfully', data: areas });
        } else {
            res.status(404).json({ message: 'No areas found' });
        }
    } catch (err) {
        console.error('Error fetching areas:', err.message);
        res.status(500).json({ error: 'Failed to retrieve areas' });
    }
});



module.exports = router;

