// Professional Email Template Utilities
// Reusable HTML email templates with responsive design

interface EmailConfig {
    companyName: string;
    primaryColor: string;
    logoUrl?: string;
    supportEmail: string;
    websiteUrl: string;
}

const defaultConfig: EmailConfig = {
    companyName: "Liv Well Research Labs",
    primaryColor: "#3B82F6",
    supportEmail: "support@livwellresearch.com",
    websiteUrl: "https://livwellresearch.com",
};

export function getEmailTemplate(
    content: string,
    config: Partial<EmailConfig> = {}
): string {
    const cfg = { ...defaultConfig, ...config };

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${cfg.companyName}</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f3f4f6;
            color: #1f2937;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
        }
        .header {
            background: linear-gradient(135deg, ${cfg.primaryColor} 0%, ${cfg.primaryColor}dd 100%);
            padding: 40px 20px;
            text-align: center;
        }
        .logo {
            font-size: 28px;
            font-weight: bold;
            color: #ffffff;
            text-decoration: none;
        }
        .content {
            padding: 40px 30px;
        }
        .button {
            display: inline-block;
            padding: 14px 32px;
            background-color: ${cfg.primaryColor};
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
        }
        .footer {
            background-color: #f9fafb;
            padding: 30px;
            text-align: center;
            font-size: 14px;
            color: #6b7280;
            border-top: 1px solid #e5e7eb;
        }
        .footer a {
            color: ${cfg.primaryColor};
            text-decoration: none;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
        }
        th {
            background-color: #f9fafb;
            font-weight: 600;
            color: #374151;
        }
        .total-row {
            font-weight: 600;
            font-size: 16px;
            background-color: #f9fafb;
        }
        @media only screen and (max-width: 600px) {
            .content {
                padding: 30px 20px;
            }
            .button {
                display: block;
                text-align: center;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            ${cfg.logoUrl
            ? `<img src="${cfg.logoUrl}" alt="${cfg.companyName}" style="max-height: 50px;">`
            : `<div class="logo">${cfg.companyName}</div>`
        }
        </div>
        <div class="content">
            ${content}
        </div>
        <div class="footer">
            <p><strong>${cfg.companyName}</strong></p>
            <p>
                Questions? Contact us at <a href="mailto:${cfg.supportEmail}">${cfg.supportEmail}</a>
            </p>
            <p style="margin-top: 20px; font-size: 12px; color: #9ca3af;">
                © ${new Date().getFullYear()} ${cfg.companyName}. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>
    `.trim();
}

export function getOrderConfirmationEmail(orderData: {
    orderNumber: string;
    customerName: string;
    items: Array<{ name: string; quantity: number; price: number }>;
    subtotal: number;
    shipping: number;
    total: number;
    trackingUrl?: string;
}): string {
    const itemsHtml = orderData.items.map(item => `
        <tr>
            <td>${item.name}</td>
            <td style="text-align: center;">${item.quantity}</td>
            <td style="text-align: right;">$${item.price.toFixed(2)}</td>
        </tr>
    `).join('');

    const content = `
        <h1 style="color: #111827; margin-top: 0;">Order Confirmed!</h1>
        <p style="font-size: 16px; line-height: 1.6; color: #4b5563;">
            Hi ${orderData.customerName},
        </p>
        <p style="font-size: 16px; line-height: 1.6; color: #4b5563;">
            Thank you for your order! We're preparing your items for shipment.
        </p>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Order Number</p>
            <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: 600; color: #111827;">#${orderData.orderNumber}</p>
        </div>

        <h2 style="color: #111827; font-size: 18px; margin-top: 30px;">Order Details</h2>
        <table>
            <thead>
                <tr>
                    <th>Product</th>
                    <th style="text-align: center;">Quantity</th>
                    <th style="text-align: right;">Price</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
                <tr>
                    <td colspan="2" style="text-align: right; padding-top: 20px;"><strong>Subtotal:</strong></td>
                    <td style="text-align: right; padding-top: 20px;">$${orderData.subtotal.toFixed(2)}</td>
                </tr>
                <tr>
                    <td colspan="2" style="text-align: right;"><strong>Shipping:</strong></td>
                    <td style="text-align: right;">$${orderData.shipping.toFixed(2)}</td>
                </tr>
                <tr class="total-row">
                    <td colspan="2" style="text-align: right;"><strong>Total:</strong></td>
                    <td style="text-align: right;"><strong>$${orderData.total.toFixed(2)}</strong></td>
                </tr>
            </tbody>
        </table>

        ${orderData.trackingUrl ? `
            <a href="${orderData.trackingUrl}" class="button">Track Your Order</a>
        ` : ''}

        <p style="font-size: 14px; line-height: 1.6; color: #6b7280; margin-top: 30px;">
            You'll receive another email when your order ships.
        </p>
    `;

    return getEmailTemplate(content);
}

export function getAdminNotificationEmail(orderData: {
    orderNumber: string;
    customerName: string;
    customerEmail: string;
    items: Array<{ name: string; quantity: number; price: number }>;
    total: number;
    shippingAddress?: string;
}): string {
    const itemsHtml = orderData.items.map(item => `
        <tr>
            <td>${item.name}</td>
            <td style="text-align: center;">${item.quantity}</td>
            <td style="text-align: right;">$${item.price.toFixed(2)}</td>
        </tr>
    `).join('');

    const content = `
        <h1 style="color: #111827; margin-top: 0;">🎉 New Order Received</h1>
        <p style="font-size: 16px; line-height: 1.6; color: #4b5563;">
            A new order has been placed and requires processing.
        </p>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Order Number</p>
            <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: 600; color: #111827;">#${orderData.orderNumber}</p>
        </div>

        <h2 style="color: #111827; font-size: 18px;">Customer Information</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #4b5563;">
            <strong>Name:</strong> ${orderData.customerName}<br>
            <strong>Email:</strong> ${orderData.customerEmail}
            ${orderData.shippingAddress ? `<br><strong>Shipping:</strong> ${orderData.shippingAddress}` : ''}
        </p>

        <h2 style="color: #111827; font-size: 18px; margin-top: 30px;">Order Items</h2>
        <table>
            <thead>
                <tr>
                    <th>Product</th>
                    <th style="text-align: center;">Quantity</th>
                    <th style="text-align: right;">Price</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
                <tr class="total-row">
                    <td colspan="2" style="text-align: right;"><strong>Total:</strong></td>
                    <td style="text-align: right;"><strong>$${orderData.total.toFixed(2)}</strong></td>
                </tr>
            </tbody>
        </table>

        <p style="font-size: 14px; line-height: 1.6; color: #6b7280; margin-top: 30px;">
            Please process this order in the admin panel.
        </p>
    `;

    return getEmailTemplate(content);
}

export function getOrderStatusUpdateEmail(orderData: {
    orderNumber: string;
    customerName: string;
    status: string;
    trackingUrl?: string;
}): string {
    // Map status to user-friendly text and colors
    const statusMap: Record<string, { text: string; color: string; bgColor: string }> = {
        pending: { text: 'Pending', color: '#f59e0b', bgColor: '#fef3c7' },
        processing: { text: 'Processing', color: '#3b82f6', bgColor: '#dbeafe' },
        shipped: { text: 'Shipped', color: '#10b981', bgColor: '#d1fae5' },
        delivered: { text: 'Delivered', color: '#059669', bgColor: '#a7f3d0' },
        cancelled: { text: 'Cancelled', color: '#ef4444', bgColor: '#fee2e2' },
    };

    const statusInfo = statusMap[orderData.status.toLowerCase()] || {
        text: orderData.status,
        color: '#6b7280',
        bgColor: '#f3f4f6'
    };

    const content = `
        <h1 style="color: #111827; margin-top: 0;">Order Status Update</h1>
        <p style="font-size: 16px; line-height: 1.6; color: #4b5563;">
            Hi ${orderData.customerName},
        </p>
        <p style="font-size: 16px; line-height: 1.6; color: #4b5563;">
            Great news! Your order status has been updated.
        </p>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Order Number</p>
            <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: 600; color: #111827;">#${orderData.orderNumber}</p>
        </div>

        <div style="background-color: ${statusInfo.bgColor}; border-left: 4px solid ${statusInfo.color}; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Current Status</p>
            <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: 700; color: ${statusInfo.color};">${statusInfo.text}</p>
        </div>

        ${orderData.trackingUrl ? `
            <a href="${orderData.trackingUrl}" class="button">Track Your Order</a>
        ` : ''}

        <p style="font-size: 14px; line-height: 1.6; color: #6b7280; margin-top: 30px;">
            ${orderData.status.toLowerCase() === 'shipped'
            ? "Your order is on its way! You should receive it within 2-3 business days."
            : orderData.status.toLowerCase() === 'delivered'
                ? "Your order has been delivered. We hope you enjoy your purchase!"
                : "We'll keep you updated on any changes to your order status."}
        </p>
    `;

    return getEmailTemplate(content);
}


// Supabase Auth Email Templates
export const authEmailTemplates = {
    confirmSignup: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #3B82F6 0%, #3B82F6dd 100%); padding: 40px 20px; text-align: center; }
        .logo { font-size: 28px; font-weight: bold; color: #ffffff; }
        .content { padding: 40px 30px; }
        .button { display: inline-block; padding: 14px 32px; background-color: #3B82F6; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
        .footer { background-color: #f9fafb; padding: 30px; text-align: center; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Liv Well Research Labs</div>
        </div>
        <div class="content">
            <h1 style="color: #111827; margin-top: 0;">Confirm Your Email</h1>
            <p style="font-size: 16px; line-height: 1.6; color: #4b5563;">
                Welcome! Please confirm your email address to complete your registration.
            </p>
            <a href="{{ .ConfirmationURL }}" class="button">Confirm Email Address</a>
            <p style="font-size: 14px; line-height: 1.6; color: #6b7280; margin-top: 30px;">
                If you didn't create an account, you can safely ignore this email.
            </p>
        </div>
        <div class="footer">
            <p><strong>Liv Well Research Labs</strong></p>
            <p>© ${new Date().getFullYear()} Liv Well Research Labs. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `,

    resetPassword: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #3B82F6 0%, #3B82F6dd 100%); padding: 40px 20px; text-align: center; }
        .logo { font-size: 28px; font-weight: bold; color: #ffffff; }
        .content { padding: 40px 30px; }
        .button { display: inline-block; padding: 14px 32px; background-color: #3B82F6; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
        .footer { background-color: #f9fafb; padding: 30px; text-align: center; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Liv Well Research Labs</div>
        </div>
        <div class="content">
            <h1 style="color: #111827; margin-top: 0;">Reset Your Password</h1>
            <p style="font-size: 16px; line-height: 1.6; color: #4b5563;">
                We received a request to reset your password. Click the button below to create a new password.
            </p>
            <a href="{{ .ConfirmationURL }}" class="button">Reset Password</a>
            <p style="font-size: 14px; line-height: 1.6; color: #6b7280; margin-top: 30px;">
                This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
            </p>
        </div>
        <div class="footer">
            <p><strong>Liv Well Research Labs</strong></p>
            <p>© ${new Date().getFullYear()} Liv Well Research Labs. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `,

    magicLink: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #3B82F6 0%, #3B82F6dd 100%); padding: 40px 20px; text-align: center; }
        .logo { font-size: 28px; font-weight: bold; color: #ffffff; }
        .content { padding: 40px 30px; }
        .button { display: inline-block; padding: 14px 32px; background-color: #3B82F6; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
        .footer { background-color: #f9fafb; padding: 30px; text-align: center; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Liv Well Research Labs</div>
        </div>
        <div class="content">
            <h1 style="color: #111827; margin-top: 0;">Sign In to Your Account</h1>
            <p style="font-size: 16px; line-height: 1.6; color: #4b5563;">
                Click the button below to securely sign in to your account.
            </p>
            <a href="{{ .ConfirmationURL }}" class="button">Sign In</a>
            <p style="font-size: 14px; line-height: 1.6; color: #6b7280; margin-top: 30px;">
                This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
            </p>
        </div>
        <div class="footer">
            <p><strong>Liv Well Research Labs</strong></p>
            <p>© ${new Date().getFullYear()} Liv Well Research Labs. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `,
};

