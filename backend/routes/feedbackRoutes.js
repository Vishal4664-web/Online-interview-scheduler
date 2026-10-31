
const express = require('express');
const Interview = require('../models/Interview');
const Feedback = require('../models/Feedback');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);


// 1. Get feedback for an interview
router.get('/interview/:id', async (req, res) => {
    try {
        const interview = await Interview.findById(req.params.id);

        if (!interview) {
            return res.status(404).json({
                message: 'Interview not found.'
            });
        }

        if (
            req.user.role !== 'recruiter' &&
            String(interview.interviewer) !== String(req.user._id)
        ) {
            return res.status(403).json({
                message: 'Not allowed.'
            });
        }

        const feedback = await Feedback.find({
            interview: interview._id
        }).populate('interviewer', 'name email');

        return res.json(feedback);

    } catch (error) {
        console.error('Get feedback error:', error);

        return res.status(400).json({
            message: 'Could not load feedback.'
        });
    }
});


// 2. Submit or update interview feedback
router.post('/', async (req, res) => {
    try {
        const {
            interview: interviewId,
            technical,
            communication,
            problemSolving,
            comments = '',
            recommendation
        } = req.body;

        if (!interviewId) {
            return res.status(400).json({
                message: 'Interview ID is required.'
            });
        }

        const interview = await Interview.findById(interviewId);

        if (!interview) {
            return res.status(404).json({
                message: 'Interview not found.'
            });
        }

        if (String(interview.interviewer) !== String(req.user._id)) {
            return res.status(403).json({
                message: 'Only the assigned interviewer can submit feedback.'
            });
        }

        if (interview.status !== 'Completed') {
            return res.status(400).json({
                message: 'Mark the interview completed before submitting feedback.'
            });
        }

        const scores = [
            technical,
            communication,
            problemSolving
        ].map(Number);

        if (
            scores.some(
                score => !Number.isInteger(score) || score < 1 || score > 5
            )
        ) {
            return res.status(400).json({
                message: 'All score values must be from 1 to 5.'
            });
        }

        const item = await Feedback.findOneAndUpdate(
            {
                interview: interviewId,
                interviewer: req.user._id
            },
            {
                interview: interviewId,
                interviewer: req.user._id,
                technical: scores[0],
                communication: scores[1],
                problemSolving: scores[2],
                comments,
                recommendation
            },
            {
                new: true,
                upsert: true,
                runValidators: true
            }
        );

        return res.status(201).json(item);

    } catch (error) {
        console.error('Save feedback error:', error);

        return res.status(400).json({
            message: 'Could not save feedback.'
        });
    }
});


// 3. Generate AI feedback summary using Gemini
router.post('/:id/ai-summary', async (req, res) => {
    try {
        const item = await Feedback.findById(req.params.id)
            .populate('interview');

        if (!item) {
            return res.status(404).json({
                message: 'Feedback not found.'
            });
        }

        if (
            req.user.role !== 'recruiter' &&
            String(item.interviewer) !== String(req.user._id)
        ) {
            return res.status(403).json({
                message: 'Not allowed.'
            });
        }

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(503).json({
                message: 'AI summary is not configured. Add GEMINI_API_KEY to your environment variables.'
            });
        }

        const interview = item.interview;

        if (!interview) {
            return res.status(404).json({
                message: 'Associated interview not found.'
            });
        }

        // Prepare AI prompt
        const prompt = `
Summarize this interview feedback objectively in 3-5 sentences.

Do not invent facts. Mention strengths and areas for improvement.
State clearly that the human interviewer makes the final hiring decision.

Candidate: ${interview.candidateName}
Role: ${interview.jobRole}

Technical skills: ${item.technical}/5
Communication: ${item.communication}/5
Problem solving: ${item.problemSolving}/5

Recommendation: ${item.recommendation}
Comments: ${item.comments || 'No additional comments provided.'}
`;

        console.log('Sending request to Gemini...');

        // Make one Gemini API request
        const response = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/interactions',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                body: JSON.stringify({
                    model: 'gemini-3.8-flash',
                    input: prompt,
                    store: false
                }),
                signal: AbortSignal.timeout(60000)
            }
        );

        // Read response as text for better error debugging
        const responseText = await response.text();

        console.log('Gemini HTTP status:', response.status);
        console.log('Gemini response:', responseText);

        let data;

        try {
            data = JSON.parse(responseText);
        } catch (error) {
            console.error('Gemini JSON parsing error:', error);

            return res.status(502).json({
                message: 'Gemini returned an invalid response.'
            });
        }

        // Handle Gemini API errors
        if (!response.ok) {
            console.error('Gemini API error:', data);

            if (response.status === 429) {
                return res.status(429).json({
                    message: 'Gemini free-tier rate limit reached. Please wait before trying again.'
                });
            }

            if (
                response.status === 500 ||
                response.status === 502 ||
                response.status === 503 ||
                response.status === 504
            ) {
                return res.status(503).json({
                    message: 'Gemini AI service is temporarily unavailable. Please try again later.'
                });
            }

            return res.status(response.status).json({
                message:
                    data.error?.message ||
                    data.message ||
                    'Gemini API request failed.'
            });
        }

        // Extract generated text
        const summary =
            data.output_text ||
            data.outputs?.map(output =>
                output.text || ''
            ).filter(Boolean).join('\n') ||
            '';

        if (!summary.trim()) {
            console.error('Gemini returned no summary:', data);

            return res.status(502).json({
                message: 'Gemini did not return a summary.'
            });
        }

        // Save AI summary in MongoDB
        item.aiSummary = summary.trim();

        await item.save();

        console.log('AI feedback summary saved successfully.');

        return res.json({
            message: 'AI feedback summary generated successfully.',
            aiSummary: item.aiSummary
        });

    } catch (error) {
        console.error('AI summary error:', error);

        if (
            error.name === 'TimeoutError' ||
            error.name === 'AbortError'
        ) {
            return res.status(504).json({
                message: 'Gemini request timed out. Please try again later.'
            });
        }

        return res.status(502).json({
            message: 'Could not generate AI feedback summary.',
            error: error.message
        });
    }
});


module.exports = router;
