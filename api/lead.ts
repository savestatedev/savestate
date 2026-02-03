import type { VercelRequest, VercelResponse } from '@vercel/node';

const TWENTY_API_URL = 'https://api.mollified.app/rest';
const TWENTY_API_KEY = process.env.SAVESTATE_TWENTY_API_KEY;

interface LeadPayload {
  email: string;
  name?: string;
  useCase?: string;
  platforms?: string[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, name, useCase, platforms } = req.body as LeadPayload;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  if (!TWENTY_API_KEY) {
    console.error('SAVESTATE_TWENTY_API_KEY not configured');
    return res.status(500).json({ error: 'CRM not configured' });
  }

  try {
    // Parse name if provided
    let firstName = '';
    let lastName = '';
    if (name) {
      const parts = name.trim().split(' ');
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    } else {
      // Use email prefix as fallback
      firstName = email.split('@')[0];
    }

    // Build notes with use case and platforms
    const notes: string[] = [];
    if (useCase) notes.push(`Use Case: ${useCase}`);
    if (platforms?.length) notes.push(`Platforms: ${platforms.join(', ')}`);
    notes.push(`Source: savestate.dev lead form`);
    notes.push(`Submitted: ${new Date().toISOString()}`);

    // Create person in Twenty CRM
    const personResponse = await fetch(`${TWENTY_API_URL}/people`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TWENTY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: {
          firstName,
          lastName,
        },
        emails: {
          primaryEmail: email,
        },
      }),
    });

    if (!personResponse.ok) {
      const errorText = await personResponse.text();
      console.error('Twenty API error:', personResponse.status, errorText);
      
      // Check if duplicate email
      if (personResponse.status === 409 || errorText.includes('duplicate')) {
        return res.status(200).json({ 
          success: true, 
          message: 'Thanks! You\'re already on our list.',
          duplicate: true 
        });
      }
      
      throw new Error(`Twenty API error: ${personResponse.status}`);
    }

    const person = await personResponse.json();

    // Create a note with the use case details
    if (notes.length > 0) {
      await fetch(`${TWENTY_API_URL}/notes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TWENTY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: notes.join('\n'),
          position: 0,
          noteTargets: [{
            personId: person.data?.id || person.id,
          }],
        }),
      }).catch(err => {
        // Non-fatal - log but don't fail
        console.error('Failed to create note:', err);
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Thanks! We\'ll be in touch soon.',
    });

  } catch (error) {
    console.error('Lead capture error:', error);
    return res.status(500).json({ 
      error: 'Failed to save lead. Please try again.' 
    });
  }
}
