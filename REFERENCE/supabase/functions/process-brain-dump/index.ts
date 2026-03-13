import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting storage
const rateLimits = new Map<string, { count: number; resetTime: number }>();

// Security utilities
const sanitizeInput = (input: string): string => {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 50000);
};

const checkRateLimit = (userId: string): boolean => {
  const now = Date.now();
  const userLimit = rateLimits.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimits.set(userId, { count: 1, resetTime: now + 60000 }); // 1 minute window
    return true;
  }
  
  if (userLimit.count >= 3) { // Max 3 requests per minute
    return false;
  }
  
  userLimit.count++;
  return true;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate request method
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { content } = requestBody;

    // Validate content
    if (!content || typeof content !== 'string' || !content.trim()) {
      return new Response(JSON.stringify({ error: 'Valid content is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sanitize input
    const sanitizedContent = sanitizeInput(content);
    
    if (!sanitizedContent || sanitizedContent.length < 10) {
      return new Response(JSON.stringify({ error: 'Content too short or invalid' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (sanitizedContent.length > 50000) {
      return new Response(JSON.stringify({ error: 'Content too long' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract user ID from JWT (if available)
    const authHeader = req.headers.get('authorization');
    let userId = 'anonymous';
    
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) userId = user.id;
      } catch {
        // Continue with anonymous user
      }
    }

    // Rate limiting
    if (!checkRateLimit(userId)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `You are an AI assistant that transforms unstructured thoughts into organized, actionable tasks. 

Analyze the user's brain dump and extract specific tasks with the following structure:
- Task title (clear, actionable)
- Description (context and details)
- Priority (high, medium, low)
- Estimated hours (realistic estimate)
- Category (e.g., work, personal, admin, research, etc.)
- Micro-tasks (3-5 smaller steps with estimated minutes)

Return ONLY a JSON array of tasks, no additional text. Each task should follow this exact structure:
{
  "title": "Task title",
  "description": "Detailed description",
  "priority": "high|medium|low",
  "estimatedHours": 2.5,
  "category": "category_name",
  "microTasks": [
    { "title": "Step 1", "estimatedMinutes": 30 },
    { "title": "Step 2", "estimatedMinutes": 45 }
  ]
}`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lovable.dev',
        'X-Title': 'Brain Dump Processor',
      },
      body: JSON.stringify({
        model: 'openai/gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: sanitizedContent }
        ],
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      console.error('OpenRouter API error:', response.status);
      throw new Error('External API unavailable');
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response from OpenRouter API');
    }

    const aiResponse = data.choices[0].message.content;
    
    try {
      const tasks = JSON.parse(aiResponse);
      
      // Add unique IDs to tasks
      const tasksWithIds = tasks.map((task: any, index: number) => ({
        ...task,
        id: index + 1
      }));

      return new Response(JSON.stringify({ tasks: tasksWithIds }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (parseError) {
      console.error('Error parsing AI response');
      throw new Error('Processing failed');
    }

  } catch (error) {
    console.error('Error in process-brain-dump function:', error instanceof Error ? error.message : 'Unknown error');
    
    const errorMessage = error instanceof Error ? 
      (error.message.includes('Rate limit') ? 'Too many requests' :
       error.message.includes('Content') ? 'Invalid input' :
       error.message.includes('API') ? 'Service temporarily unavailable' :
       'Processing failed') : 'Unknown error';
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: error instanceof Error && error.message.includes('Rate limit') ? 429 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});