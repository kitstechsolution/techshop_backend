import Order from '../models/Order.js';

/**
 * Handle RazorPay webhooks for payment status updates
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const handleRazorPayWebhook = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    
    // Verify webhook signature
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      console.error('RazorPay webhook missing signature');
      return res.status(400).json({ error: 'Missing signature' });
    }
    
    // Verify signature
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');
      
    if (expectedSignature !== signature) {
      console.error('RazorPay webhook invalid signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }
    
    // Process webhook event
    const event = req.body;
    console.log('Received RazorPay webhook:', event.event);
    
    if (event.event === 'payment.authorized' || event.event === 'payment.captured') {
      const paymentId = event.payload.payment.entity.id;
      const orderId = event.payload.payment.entity.notes.orderId;
      
      if (!orderId) {
        console.error('RazorPay webhook: orderId not found in payment notes');
        return res.status(400).json({ error: 'Order ID not found' });
      }
      
      // Update order status in database
      const order = await Order.findById(orderId);
      if (!order) {
        console.error(`Order not found for ID: ${orderId}`);
        return res.status(404).json({ error: 'Order not found' });
      }
      
      order.paymentStatus = 'paid';
      order.status = 'processing';
      order.paymentDetails = {
        ...order.paymentDetails,
        paymentId,
        status: 'success',
        updatedAt: new Date()
      };
      
      await order.save();
      console.log(`Order ${orderId} payment status updated to paid via webhook`);
    }
    
    // Return 200 to acknowledge receipt of the webhook
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error handling RazorPay webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}; 