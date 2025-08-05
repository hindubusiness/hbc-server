require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const otpGenerator = require('otp-generator');

let otpStore = {}; // Temporary storage for OTPs

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: [
    'https://hbc-community.vercel.app',
    process.env.CLIENT_URL,
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// New endpoint to fetch member data by email
// app.get('/member/:email', async (req, res) => {
//   try {
//     const { email } = req.params;
    
//     const { data, error } = await supabase
//       .from('submissions')
//       .select('*')
//       .eq('email', email)
//       .single();

//     if (error) throw error;
//     if (!data) {
//       return res.status(404).json({ error: 'Member not found' });
//     }

//     res.json(data);
//   } catch (error) {
//     console.error('Error fetching member:', error);
//     res.status(500).json({ error: 'Failed to fetch member data' });
//   }
// });

app.get('/member/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({ error: 'Email parameter is required' });
    }

    console.log('Fetching member data for email:', email); // Debug log
    
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      console.error('Supabase error:', error); // Debug log
      throw error;
    }
    
    if (!data) {
      console.log('No member found for email:', email); // Debug log
      return res.status(404).json({ error: 'Member not found' });
    }

    console.log('Member data found:', data); // Debug log
    res.json(data);
  } catch (error) {
    console.error('Error fetching member:', error);
    res.status(500).json({ 
      error: 'Failed to fetch member data',
      details: error.message 
    });
  }
});

// New endpoint to update member data
app.put('/update-member', async (req, res) => {
  try {
    const updateData = {
      name: req.body.name,
      phone: req.body.phone,
      address: req.body.address,
      city: req.body.city,
      state: req.body.state,
      business_name: req.body.business_name,
      business_category: req.body.business_category,
      business_description: req.body.business_description,
      business_website: req.body.business_website,
      business_social_media: req.body.business_social_media,
      services_offered: req.body.services_offered,
      looking_for: req.body.looking_for
    };

    // Validate phone format if it's being updated
    if (updateData.phone) {
      const phoneRegex = /^\+91\d{10}$/;
      if (!phoneRegex.test(updateData.phone)) {
        return res.status(400).json({
          error: 'Invalid phone format',
          details: 'Phone must be in +91xxxxxxxxxx format'
        });
      }
    }

    const { data, error } = await supabase
      .from('submissions')
      .update(updateData)
      .eq('email', req.body.email)
      .select();

    if (error) {
      console.error('Update error:', error);
      return res.status(400).json({
        error: 'Database error',
        details: error.message
      });
    }

    res.json({ message: 'Member updated successfully', data });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

app.post('/submit-form', async (req, res) => {
  try {
    // Validate phone format before processing
    const phoneRegex = /^\+91\d{10}$/;
    if (!phoneRegex.test(req.body.phone)) {
      return res.status(400).json({
        error: 'Invalid phone format',
        details: 'Phone must be in +91xxxxxxxxxx format'
      });
    }

    // Map all form fields to database columns
    const formattedData = {
      // Personal Information
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      address: req.body.address,
      city: req.body.city,      
      state: req.body.state,

      // Employment Type
      employment_type: req.body.employmentType,

      // Business Details
      business_name: req.body.businessName,
      business_category: req.body.businessCategory,
      business_description: req.body.businessDescription,
      business_website: req.body.businessWebsite,
      business_social_media: req.body.businessSocialMedia,

      // Professional Details
      professional_website: req.body.professionalWebsite,
      professional_social_media: req.body.professionalSocialMedia,
      work_experience: req.body.workExperience,

      // Services & Requirements
      services_offered: req.body.servicesOffered,
      looking_for: req.body.lookingFor,

      // Agreement
      agree_to_rules: req.body.agreeToRules
    };

    // Insert into database
    const { data, error } = await supabase
      .from('submissions')
      .insert([formattedData]);

    if (error) {
      console.error('Supabase error:', error);
      // Handle unique constraint violations
      if (error.code === '23505') {
        const field = error.detail.includes('email') ? 'Email' : 'Phone';
        return res.status(409).json({
          error: `${field} already exists`,
          details: `${field} address is already registered`
        });
      }
      return res.status(400).json({
        error: 'Database error',
        details: error.message
      });
    }

    res.status(201).json({ message: 'Form submitted successfully!', data });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

app.get('/submissions', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Submissions fetch error:', error);
    res.status(500).json({ error: 'Failed to retrieve submissions' });
  }
});

app.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body;

    const { data, error } = await supabase
      .from('submissions')
      .select('email')
      .eq('email', email)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ 
        error: 'Email not found',
        message: 'This email is not registered in our database. Please join our network first.'
      });
    }

    res.status(200).json({ message: 'Email found' });
  } catch (error) {
    console.error('Email check error:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

app.post('/send-otp', async (req, res) => {
  const { email } = req.body;

  try {
    // First verify email exists in database
    const { data, error } = await supabase
      .from('submissions')
      .select('email')
      .eq('email', email)
      .single();

    if (error || !data) {
      return res.status(404).json({ 
        error: 'Email not found',
        message: 'This email is not registered in our database'
      });
    }

    // Generate numeric OTP
    const otp = otpGenerator.generate(6, {
      digits: true,
      alphabets: false,
      upperCase: false,
      specialChars: false
    });
    
    otpStore[email] = otp;

    // Configure email transport with improved settings
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const mailOptions = {
      from: {
        name: 'Bharat Community',
        address: process.env.EMAIL_USER
      },
      to: email,
      subject: 'Your Verification Code - Bharat Community',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Verification Code</h2>
          <p style="font-size: 16px; color: #666;">Hello,</p>
          <p style="font-size: 16px; color: #666;">Your verification code is:</p>
          <div style="background-color: #f4f4f4; padding: 15px; text-align: center; margin: 20px 0;">
            <h1 style="color: #333; letter-spacing: 5px; margin: 0;">${otp}</h1>
          </div>
          <p style="font-size: 14px; color: #888;">This code will expire in 10 minutes.</p>
          <p style="font-size: 14px; color: #888;">If you didn't request this code, please ignore this email.</p>
          <hr style="border: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #999;">This is an automated message, please do not reply.</p>
        </div>
      `,
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high',
        'X-Mailer': 'Bharat Community Mailer'
      }
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

app.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;

  if (otpStore[email] && otpStore[email] === otp) {
    delete otpStore[email]; // Clear the OTP after verification
    res.status(200).json({ message: 'OTP verified successfully' });
  } else {
    res.status(400).json({ error: 'Invalid OTP' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});