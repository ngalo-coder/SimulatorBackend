import User from '../models/UserModel.js';
import { generateToken } from '../services/authService.js';
import { handleSuccess, handleError } from '../utils/responseHandler.js';
import logger from '../config/logger.js';
import crypto from 'crypto';
import sendEmail from '../services/emailService.js';

async function register(req, res) {
    const log = req.log;
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            log.warn({ body: req.body }, 'Registration attempt with missing fields.');
            return res.status(400).json({ message: 'Please provide username, email, and password.' });
        }

        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            log.info({ username, email }, 'Registration failed: User already exists.');
            return res.status(409).json({ message: 'User already exists with this username or email.' });
        }

        const newUser = new User({ username, email, password });
        await newUser.save();
        log.info({ userId: newUser._id, username }, 'User registered successfully.');

        const token = generateToken(newUser._id, newUser.username, newUser.role);

        handleSuccess(res, {
            token,
            user: {
                id: newUser._id,
                username: newUser.username,
                email: newUser.email,
                role: newUser.role,
            },
        }, 'User registered successfully.', 201);
    } catch (error) {
        handleError(res, error, log);
    }
}

async function login(req, res) {
    const log = req.log;
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            log.warn({ body: req.body }, 'Login attempt with missing fields.');
            return res.status(400).json({ message: 'Please provide email and password.' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            log.warn({ email }, 'Login failed: User not found.');
            return res.status(401).json({ message: 'Invalid credentials. User not found.' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            log.warn({ email }, 'Login failed: Password incorrect.');
            return res.status(401).json({ message: 'Invalid credentials. Password incorrect.' });
        }

        log.info({ userId: user._id, email }, 'User logged in successfully.');
        const token = generateToken(user._id, user.username, user.role);
        const redirectTo = user.role === 'admin' ? '/admin/dashboard' : '/';

        handleSuccess(res, {
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
            },
            redirectTo,
        }, 'Login successful.');
    } catch (error) {
        handleError(res, error, log);
    }
}

async function forgotPassword(req, res) {
    const log = req.log;
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            log.warn({ email }, 'Password reset failed: User not found.');
            return res.status(404).json({ message: 'User not found.' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const passwordResetToken = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');

        user.passwordResetToken = passwordResetToken;
        user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

        await user.save();

        const resetURL = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`;
        const message = `Forgot your password? Submit a PATCH request with your new password to: ${resetURL}.\nIf you didn't forget your password, please ignore this email!`;

        try {
            await sendEmail({
                email: user.email,
                subject: 'Your password reset token (valid for 10 min)',
                message,
            });

            handleSuccess(res, null, 'Token sent to email!');
        } catch (err) {
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save({ validateBeforeSave: false });

            log.error(err, 'Error sending password reset email.');
            return res.status(500).json({ message: 'There was an error sending the email. Try again later!' });
        }
    } catch (error) {
        handleError(res, error, log);
    }
}

async function resetPassword(req, res) {
    const log = req.log;
    try {
        const hashedToken = crypto
            .createHash('sha256')
            .update(req.params.token)
            .digest('hex');

        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() },
        });

        if (!user) {
            log.warn('Password reset failed: Token is invalid or has expired.');
            return res.status(400).json({ message: 'Token is invalid or has expired.' });
        }

        user.password = req.body.password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        const token = generateToken(user._id, user.username, user.role);

        handleSuccess(res, {
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
            },
        }, 'Password reset successful.');
    } catch (error) {
        handleError(res, error, log);
    }
}

export { register, login, forgotPassword, resetPassword };
