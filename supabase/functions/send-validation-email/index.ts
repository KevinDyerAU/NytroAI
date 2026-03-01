import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';

/**
 * send-validation-email
 * 
 * Sends confirmation emails for the $99 Validation service via the n8n Brevo webhook.
 * Supports two email types:
 *   - "customer_confirmation": Sent to the customer after successful payment
 *   - "internal_notification": Sent to support@nytro.com.au to notify the team
 * 
 * Called from the ValidationSuccessPage after Stripe checkout completes.
 */

interface EmailRequest {
  lead_id: number;
  email_type: 'customer_confirmation' | 'internal_notification' | 'both';
}

interface LeadData {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  company_name: string | null;
  phone_number: string | null;
  file_name: string | null;
  file_url: string | null;
  status: string;
  amount_paid: number | null;
  created_at: string;
}

function buildCustomerEmailHtml(lead: LeadData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#14b8a6;font-size:28px;margin:0;">Nytro</h1>
      <p style="color:#94a3b8;font-size:14px;margin-top:4px;">Precision that powers performance.</p>
    </div>
    
    <!-- Main Content -->
    <div style="background-color:#1e293b;border-radius:16px;padding:32px;margin-bottom:24px;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="width:64px;height:64px;border-radius:50%;background-color:rgba(20,184,166,0.2);display:inline-flex;align-items:center;justify-content:center;">
          <span style="font-size:32px;">✓</span>
        </div>
      </div>
      
      <h2 style="color:#ffffff;font-size:22px;text-align:center;margin:0 0 16px;">
        Payment Confirmed
      </h2>
      
      <p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin:0 0 24px;">
        Hi ${lead.first_name},
      </p>
      
      <p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin:0 0 24px;">
        Thank you for choosing Nytro for your independent resource validation. Your payment of 
        <strong style="color:#14b8a6;">$${(lead.amount_paid || 99).toFixed(2)} AUD</strong> has been received.
      </p>
      
      <!-- Order Summary -->
      <div style="background-color:#0f172a;border-radius:12px;padding:20px;margin-bottom:24px;">
        <h3 style="color:#ffffff;font-size:16px;margin:0 0 12px;">Order Summary</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="color:#94a3b8;padding:6px 0;font-size:14px;">Service</td>
            <td style="color:#ffffff;padding:6px 0;font-size:14px;text-align:right;">Independent Resource Validation</td>
          </tr>
          <tr>
            <td style="color:#94a3b8;padding:6px 0;font-size:14px;">Amount</td>
            <td style="color:#14b8a6;padding:6px 0;font-size:14px;text-align:right;">$${(lead.amount_paid || 99).toFixed(2)} AUD</td>
          </tr>
          ${lead.company_name ? `<tr>
            <td style="color:#94a3b8;padding:6px 0;font-size:14px;">Company</td>
            <td style="color:#ffffff;padding:6px 0;font-size:14px;text-align:right;">${lead.company_name}</td>
          </tr>` : ''}
          ${lead.file_name ? `<tr>
            <td style="color:#94a3b8;padding:6px 0;font-size:14px;">Resource</td>
            <td style="color:#ffffff;padding:6px 0;font-size:14px;text-align:right;">${lead.file_name}</td>
          </tr>` : ''}
          <tr>
            <td style="color:#94a3b8;padding:6px 0;font-size:14px;">Reference</td>
            <td style="color:#ffffff;padding:6px 0;font-size:14px;text-align:right;">#VAL-${String(lead.id).padStart(5, '0')}</td>
          </tr>
        </table>
      </div>
      
      <!-- What Happens Next -->
      <h3 style="color:#ffffff;font-size:16px;margin:0 0 16px;">What happens next</h3>
      
      <div style="margin-bottom:16px;">
        <div style="display:flex;margin-bottom:12px;">
          <span style="color:#14b8a6;font-size:18px;margin-right:12px;min-width:24px;">1.</span>
          <div>
            <p style="color:#ffffff;font-size:14px;margin:0 0 4px;font-weight:bold;">Resource Review</p>
            <p style="color:#94a3b8;font-size:13px;margin:0;">Our team will review your submitted resource against the relevant unit requirements.</p>
          </div>
        </div>
        <div style="display:flex;margin-bottom:12px;">
          <span style="color:#14b8a6;font-size:18px;margin-right:12px;min-width:24px;">2.</span>
          <div>
            <p style="color:#ffffff;font-size:14px;margin:0 0 4px;font-weight:bold;">Validation Report</p>
            <p style="color:#94a3b8;font-size:13px;margin:0;">A structured validation report will be prepared mapping evidence against requirements.</p>
          </div>
        </div>
        <div style="display:flex;">
          <span style="color:#14b8a6;font-size:18px;margin-right:12px;min-width:24px;">3.</span>
          <div>
            <p style="color:#ffffff;font-size:14px;margin:0 0 4px;font-weight:bold;">Delivery</p>
            <p style="color:#94a3b8;font-size:13px;margin:0;">Your completed report will be delivered to this email within 2–3 business days.</p>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="text-align:center;padding:20px 0;">
      <p style="color:#64748b;font-size:13px;margin:0 0 8px;">
        Questions? Contact us at 
        <a href="mailto:support@nytro.com.au" style="color:#14b8a6;text-decoration:none;">support@nytro.com.au</a>
      </p>
      <p style="color:#475569;font-size:12px;margin:0;">
        Nytro Pty Ltd | 31A Ridgecrest Court, Robina QLD 4226
      </p>
      <p style="color:#475569;font-size:12px;margin:4px 0 0;">
        © ${new Date().getFullYear()} Nytro. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>`;
}

function buildInternalNotificationHtml(lead: LeadData): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:20px;background-color:#f8fafc;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;padding:24px;border:1px solid #e2e8f0;">
    <h2 style="color:#0f172a;margin:0 0 16px;">New $99 Validation Order</h2>
    
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:8px 0;color:#64748b;font-size:14px;border-bottom:1px solid #f1f5f9;">Reference</td>
        <td style="padding:8px 0;color:#0f172a;font-size:14px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:bold;">#VAL-${String(lead.id).padStart(5, '0')}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#64748b;font-size:14px;border-bottom:1px solid #f1f5f9;">Customer</td>
        <td style="padding:8px 0;color:#0f172a;font-size:14px;border-bottom:1px solid #f1f5f9;text-align:right;">${lead.first_name} ${lead.last_name}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#64748b;font-size:14px;border-bottom:1px solid #f1f5f9;">Email</td>
        <td style="padding:8px 0;color:#0f172a;font-size:14px;border-bottom:1px solid #f1f5f9;text-align:right;">
          <a href="mailto:${lead.email}" style="color:#14b8a6;">${lead.email}</a>
        </td>
      </tr>
      ${lead.company_name ? `<tr>
        <td style="padding:8px 0;color:#64748b;font-size:14px;border-bottom:1px solid #f1f5f9;">Company</td>
        <td style="padding:8px 0;color:#0f172a;font-size:14px;border-bottom:1px solid #f1f5f9;text-align:right;">${lead.company_name}</td>
      </tr>` : ''}
      ${lead.phone_number ? `<tr>
        <td style="padding:8px 0;color:#64748b;font-size:14px;border-bottom:1px solid #f1f5f9;">Phone</td>
        <td style="padding:8px 0;color:#0f172a;font-size:14px;border-bottom:1px solid #f1f5f9;text-align:right;">${lead.phone_number}</td>
      </tr>` : ''}
      <tr>
        <td style="padding:8px 0;color:#64748b;font-size:14px;border-bottom:1px solid #f1f5f9;">Amount</td>
        <td style="padding:8px 0;color:#14b8a6;font-size:14px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:bold;">$${(lead.amount_paid || 99).toFixed(2)} AUD</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#64748b;font-size:14px;border-bottom:1px solid #f1f5f9;">Resource</td>
        <td style="padding:8px 0;color:#0f172a;font-size:14px;border-bottom:1px solid #f1f5f9;text-align:right;">${lead.file_name || 'Not uploaded'}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#64748b;font-size:14px;">Submitted</td>
        <td style="padding:8px 0;color:#0f172a;font-size:14px;text-align:right;">${new Date(lead.created_at).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })}</td>
      </tr>
    </table>
    
    <div style="margin-top:20px;padding:16px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;">
      <p style="color:#166534;font-size:14px;margin:0;">
        <strong>Action required:</strong> Review and process this validation request within 2–3 business days.
      </p>
    </div>
  </div>
</body>
</html>`;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body: EmailRequest = await req.json();
    const { lead_id, email_type } = body;

    if (!lead_id || !email_type) {
      return createErrorResponse('Missing required fields: lead_id, email_type');
    }

    // Initialize Supabase with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      return createErrorResponse('Supabase configuration missing', 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch lead data
    const { data: lead, error: leadError } = await supabase
      .from('validation_leads')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (leadError || !lead) {
      return createErrorResponse(`Lead not found: ${leadError?.message || 'Unknown error'}`, 404);
    }

    // n8n Brevo webhook URL (hardcoded for now)
    // TODO: Move to Supabase edge function secret N8N_BREVO_WEBHOOK_URL
    // See NytroDocs: /architecture/validation-flow for migration instructions
    const n8nBrevoWebhookUrl = 'https://n8n-gtoa.onrender.com/webhook/send-email-brevo';

    const results: { customer?: boolean; internal?: boolean } = {};

    // Send customer confirmation email
    if (email_type === 'customer_confirmation' || email_type === 'both') {
      try {
        const customerResponse = await fetch(n8nBrevoWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender: { email: 'noreply@nytrolms.com', name: 'Nytro' },
            to: { email: lead.email, name: `${lead.first_name} ${lead.last_name}` },
            subject: `Payment Confirmed — Validation #VAL-${String(lead.id).padStart(5, '0')}`,
            body_html: buildCustomerEmailHtml(lead as LeadData),
            body_text: `Hi ${lead.first_name}, your payment of $${(lead.amount_paid || 99).toFixed(2)} AUD for independent resource validation has been confirmed. Reference: #VAL-${String(lead.id).padStart(5, '0')}. Your validation report will be delivered within 2-3 business days.`,
            template_key: 'validation_payment_confirmation',
            event_type: 'validation_payment',
            name: `${lead.first_name} ${lead.last_name}`,
          }),
        });

        results.customer = customerResponse.ok;
        if (!customerResponse.ok) {
          console.error('[send-validation-email] Customer email failed:', await customerResponse.text());
        }
      } catch (err) {
        console.error('[send-validation-email] Customer email error:', err);
        results.customer = false;
      }
    }

    // Send internal notification to support@nytro.com.au
    if (email_type === 'internal_notification' || email_type === 'both') {
      try {
        const internalResponse = await fetch(n8nBrevoWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender: { email: 'noreply@nytrolms.com', name: 'Nytro System' },
            to: { email: 'support@nytro.com.au', name: 'Nytro Support' },
            subject: `New Validation Order #VAL-${String(lead.id).padStart(5, '0')} — ${lead.first_name} ${lead.last_name}`,
            body_html: buildInternalNotificationHtml(lead as LeadData),
            body_text: `New $99 validation order from ${lead.first_name} ${lead.last_name} (${lead.email}). Company: ${lead.company_name || 'N/A'}. Resource: ${lead.file_name || 'Not uploaded'}. Reference: #VAL-${String(lead.id).padStart(5, '0')}.`,
            template_key: 'validation_internal_notification',
            event_type: 'validation_new_order',
            name: 'Nytro Support',
          }),
        });

        results.internal = internalResponse.ok;
        if (!internalResponse.ok) {
          console.error('[send-validation-email] Internal email failed:', await internalResponse.text());
        }
      } catch (err) {
        console.error('[send-validation-email] Internal email error:', err);
        results.internal = false;
      }
    }

    // Update lead with email_sent flag
    await supabase
      .from('validation_leads')
      .update({ 
        updated_at: new Date().toISOString(),
      })
      .eq('id', lead_id);

    return createSuccessResponse({
      success: true,
      emails_sent: results,
      lead_id: lead_id,
    });

  } catch (error) {
    console.error('[send-validation-email] Error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Failed to send email',
      500
    );
  }
});
