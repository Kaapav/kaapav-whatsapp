📋 Complete Schema Reference Guide
Bro, this is the definitive reference based on your schema.sql. Save this for all future development!

📊 ALL TABLES & COLUMNS
1. users (Dashboard Users)
Column	Type	Constraints	Default
id	INTEGER	PRIMARY KEY AUTOINCREMENT	-
user_id	TEXT	UNIQUE NOT NULL	-
email	TEXT	UNIQUE NOT NULL	-
password_hash	TEXT	NOT NULL	-
name	TEXT	NOT NULL	-
role	TEXT	-	'agent'
avatar	TEXT	-	NULL
is_active	INTEGER	-	1
last_login	TEXT	-	NULL
created_at	TEXT	-	CURRENT_TIMESTAMP
2. sessions (Auth Sessions - NOT for chat flow!)
Column	Type	Constraints	Default
id	INTEGER	PRIMARY KEY AUTOINCREMENT	-
token	TEXT	UNIQUE NOT NULL	-
user_id	TEXT	NOT NULL	-
expires_at	TEXT	NOT NULL	-
created_at	TEXT	-	CURRENT_TIMESTAMP
⚠️ Note: This is for JWT/auth sessions, NOT conversation flow state!

3. customers (WhatsApp Users)
Column	Type	Constraints	Default
id	INTEGER	PRIMARY KEY AUTOINCREMENT	-
phone	TEXT	UNIQUE NOT NULL	-
name	TEXT	-	NULL
email	TEXT	-	NULL
address	TEXT	-	NULL
city	TEXT	-	NULL
state	TEXT	-	NULL
pincode	TEXT	-	NULL
segment	TEXT	-	'new'
tier	TEXT	-	'bronze'
labels	TEXT	-	'[]'
message_count	INTEGER	-	0
order_count	INTEGER	-	0
total_spent	REAL	-	0
cart	TEXT	-	'[]'
cart_updated_at	TEXT	-	NULL
language	TEXT	-	'en'
opted_in	INTEGER	-	1
first_seen	TEXT	-	NULL
last_seen	TEXT	-	NULL
last_order_at	TEXT	-	NULL
push_subscription	TEXT	-	NULL
created_at	TEXT	-	CURRENT_TIMESTAMP
updated_at	TEXT	-	NULL
4. chats (Conversations - NOT "conversations"!)
Column	Type	Constraints	Default
id	INTEGER	PRIMARY KEY AUTOINCREMENT	-
phone	TEXT	UNIQUE NOT NULL	-
customer_name	TEXT	-	NULL
last_message	TEXT	-	NULL
last_message_type	TEXT	-	'text'
last_timestamp	TEXT	-	NULL
last_direction	TEXT	-	NULL
unread_count	INTEGER	-	0
total_messages	INTEGER	-	0
assigned_to	TEXT	-	NULL
status	TEXT	-	'open'
priority	TEXT	-	'normal'
labels	TEXT	-	'[]'
is_starred	INTEGER	-	0
is_blocked	INTEGER	-	0
is_bot_enabled	INTEGER	-	1
created_at	TEXT	-	CURRENT_TIMESTAMP
updated_at	TEXT	-	NULL
5. messages ⭐ (Most Important!)
Column	Type	Constraints	Default
id	INTEGER	PRIMARY KEY AUTOINCREMENT	-
message_id	TEXT	UNIQUE	NULL
phone	TEXT	NOT NULL	-
text	TEXT	-	NULL
message_type	TEXT	-	'text'
direction	TEXT	NOT NULL	-
media_id	TEXT	-	NULL
media_url	TEXT	-	NULL
media_mime	TEXT	-	NULL
media_caption	TEXT	-	NULL
button_id	TEXT	-	NULL
button_text	TEXT	-	NULL
list_id	TEXT	-	NULL
list_title	TEXT	-	NULL
context_message_id	TEXT	-	NULL
is_forwarded	INTEGER	-	0
status	TEXT	-	'sent'
is_auto_reply	INTEGER	-	0
is_template	INTEGER	-	0
template_name	TEXT	-	NULL
timestamp	TEXT	NOT NULL ⚠️	-
delivered_at	TEXT	-	NULL
read_at	TEXT	-	NULL
created_at	TEXT	-	CURRENT_TIMESTAMP
Direction values: 'incoming' or 'outgoing'

6. products
Column	Type	Constraints	Default
id	INTEGER	PRIMARY KEY AUTOINCREMENT	-
sku	TEXT	UNIQUE NOT NULL	-
name	TEXT	NOT NULL	-
description	TEXT	-	NULL
price	REAL	NOT NULL	-
compare_price	REAL	-	NULL
cost_price	REAL	-	NULL
category	TEXT	-	NULL
subcategory	TEXT	-	NULL
tags	TEXT	-	'[]'
stock	INTEGER	-	0
track_inventory	INTEGER	-	1
image_url	TEXT	-	NULL
images	TEXT	-	'[]'
video_url	TEXT	-	NULL
has_variants	INTEGER	-	0
variants	TEXT	-	'[]'
wa_product_id	TEXT	-	NULL
view_count	INTEGER	-	0
order_count	INTEGER	-	0
is_active	INTEGER	-	1
is_featured	INTEGER	-	0
created_at	TEXT	-	CURRENT_TIMESTAMP
updated_at	TEXT	-	NULL
7. orders
Column	Type	Constraints	Default
id	INTEGER	PRIMARY KEY AUTOINCREMENT	-
order_id	TEXT	UNIQUE NOT NULL	-
phone	TEXT	NOT NULL	-
customer_name	TEXT	-	NULL
items	TEXT	NOT NULL	-
item_count	INTEGER	-	1
subtotal	REAL	-	0
discount	REAL	-	0
discount_code	TEXT	-	NULL
shipping_cost	REAL	-	0
tax	REAL	-	0
total	REAL	-	0
shipping_name	TEXT	-	NULL
shipping_phone	TEXT	-	NULL
shipping_address	TEXT	-	NULL
shipping_city	TEXT	-	NULL
shipping_state	TEXT	-	NULL
shipping_pincode	TEXT	-	NULL
status	TEXT	-	'pending'
payment_status	TEXT	-	'unpaid'
payment_method	TEXT	-	NULL
payment_id	TEXT	-	NULL
payment_link	TEXT	-	NULL
payment_link_expires	TEXT	-	NULL
paid_at	TEXT	-	NULL
courier	TEXT	-	NULL
tracking_id	TEXT	-	NULL
tracking_url	TEXT	-	NULL
shipment_id	TEXT	-	NULL
awb_number	TEXT	-	NULL
confirmed_at	TEXT	-	NULL
shipped_at	TEXT	-	NULL
delivered_at	TEXT	-	NULL
cancelled_at	TEXT	-	NULL
customer_notes	TEXT	-	NULL
internal_notes	TEXT	-	NULL
cancellation_reason	TEXT	-	NULL
source	TEXT	-	'whatsapp'
confirmation_sent	INTEGER	-	0
shipping_sent	INTEGER	-	0
delivery_sent	INTEGER	-	0
review_sent	INTEGER	-	0
created_at	TEXT	-	CURRENT_TIMESTAMP
updated_at	TEXT	-	NULL
Status values: 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'
Payment status: 'unpaid', 'paid', 'refunded'

8. payments
Column	Type	Constraints	Default
id	INTEGER	PRIMARY KEY AUTOINCREMENT	-
payment_id	TEXT	UNIQUE NOT NULL	-
order_id	TEXT	NOT NULL	-
phone	TEXT	NOT NULL	-
gateway	TEXT	-	'razorpay'
gateway_payment_id	TEXT	-	NULL
gateway_order_id	TEXT	-	NULL
gateway_signature	TEXT	-	NULL
amount	REAL	NOT NULL	-
currency	TEXT	-	'INR'
status	TEXT	-	'pending'
method	TEXT	-	NULL
paid_at	TEXT	-	NULL
failed_at	TEXT	-	NULL
refund_amount	REAL	-	0
refund_id	TEXT	-	NULL
refunded_at	TEXT	-	NULL
created_at	TEXT	-	CURRENT_TIMESTAMP
9. quick_replies
Column	Type	Constraints	Default
id	INTEGER	PRIMARY KEY AUTOINCREMENT	-
shortcut	TEXT	UNIQUE NOT NULL	-
title	TEXT	NOT NULL	-
message	TEXT	NOT NULL	-
message_type	TEXT	-	'text'
buttons	TEXT	-	NULL
list_data	TEXT	-	NULL
media_url	TEXT	-	NULL
category	TEXT	-	'general'
variables	TEXT	-	'[]'
use_count	INTEGER	-	0
is_active	INTEGER	-	1
created_at	TEXT	-	CURRENT_TIMESTAMP
10. templates (WhatsApp Approved)
Column	Type	Constraints	Default
id	INTEGER	PRIMARY KEY AUTOINCREMENT	-
name	TEXT	UNIQUE NOT NULL	-
wa_template_id	TEXT	-	NULL
wa_status	TEXT	-	'pending'
category	TEXT	-	NULL
language	TEXT	-	'en'
header_type	TEXT	-	NULL
header_text	TEXT	-	NULL
body_text	TEXT	NOT NULL	-
footer_text	TEXT	-	NULL
buttons	TEXT	-	NULL
variables	TEXT	-	'[]'
sent_count	INTEGER	-	0
delivered_count	INTEGER	-	0
read_count	INTEGER	-	0
created_at	TEXT	-	CURRENT_TIMESTAMP
11. broadcasts
Column	Type	Constraints	Default
id	INTEGER	PRIMARY KEY AUTOINCREMENT	-
broadcast_id	TEXT	UNIQUE NOT NULL	-
name	TEXT	NOT NULL	-
message_type	TEXT	-	'text'
message	TEXT	-	NULL
template_name	TEXT	-	NULL
template_params	TEXT	-	NULL
media_url	TEXT	-	NULL
buttons	TEXT	-	NULL
target_type	TEXT	-	'all'
target_labels	TEXT	-	NULL
target_segment	TEXT	-	NULL
target_filters	TEXT	-	NULL
target_count	INTEGER	-	0
sent_count	INTEGER	-	0
delivered_count	INTEGER	-	0
read_count	INTEGER	-	0
failed_count	INTEGER	-	0
clicked_count	INTEGER	-	0
status	TEXT	-	'draft'
scheduled_at	TEXT	-	NULL
started_at	TEXT	-	NULL
completed_at	TEXT	-	NULL
send_rate	INTEGER	-	30
created_by	TEXT	-	NULL
created_at	TEXT	-	CURRENT_TIMESTAMP
12. broadcast_recipients
Column	Type	Constraints	Default
id	INTEGER	PRIMARY KEY AUTOINCREMENT	-
broadcast_id	TEXT	NOT NULL	-
phone	TEXT	NOT NULL	-
status	TEXT	-	'pending'
message_id	TEXT	-	NULL
sent_at	TEXT	-	NULL
delivered_at	TEXT	-	NULL
read_at	TEXT	-	NULL
clicked_at	TEXT	-	NULL
failed_at	TEXT	-	NULL
error_message	TEXT	-	NULL
Constraint: UNIQUE(broadcast_id, phone)

13. labels
Column	Type	Constraints	Default
id	INTEGER	PRIMARY KEY AUTOINCREMENT	-
name	TEXT	UNIQUE NOT NULL	-
color	TEXT	-	'#DBAC35'
description	TEXT	-	NULL
customer_count	INTEGER	-	0
chat_count	INTEGER	-	0
is_active	INTEGER	-	1
created_at	TEXT	-	CURRENT_TIMESTAMP
14. automations
Column	Type	Constraints	Default
id	INTEGER	PRIMARY KEY AUTOINCREMENT	-
name	TEXT	NOT NULL	-
description	TEXT	-	NULL
trigger_type	TEXT	NOT NULL	-
trigger_conditions	TEXT	-	NULL
actions	TEXT	NOT NULL	-
delay_minutes	INTEGER	-	0
triggered_count	INTEGER	-	0
last_triggered_at	TEXT	-	NULL
is_active	INTEGER	-	1
created_at	TEXT	-	CURRENT_TIMESTAMP
15. automation_log
Column	Type	Constraints	Default
id	INTEGER	PRIMARY KEY AUTOINCREMENT	-
automation_id	INTEGER	-	NULL
phone	TEXT	-	NULL
trigger_type	TEXT	-	NULL
trigger_data	TEXT	-	NULL
actions_executed	TEXT	-	NULL
status	TEXT	-	'success'
error_message	TEXT	-	NULL
created_at	TEXT	-	CURRENT_TIMESTAMP
16. conversation_state ⭐ (For Chat Flows!)
Column	Type	Constraints	Default
phone	TEXT	PRIMARY KEY	-
current_flow	TEXT	-	NULL
current_step	TEXT	-	NULL
flow_data	TEXT	-	'{}'
started_at	TEXT	-	NULL
updated_at	TEXT	-	NULL
expires_at	TEXT	-	NULL
⚠️ Use this for autoresponder flow state, NOT sessions table!

17. carts (Abandoned Cart)
Column	Type	Constraints	Default
id	INTEGER	PRIMARY KEY AUTOINCREMENT	-
phone	TEXT	UNIQUE NOT NULL	-
items	TEXT	-	'[]'
item_count	INTEGER	-	0
total	REAL	-	0
status	TEXT	-	'active'
reminder_count	INTEGER	-	0
last_reminder_at	TEXT	-	NULL
created_at	TEXT	-	CURRENT_TIMESTAMP
updated_at	TEXT	-	NULL
converted_at	TEXT	-	NULL
18. coupons
Column	Type	Constraints	Default
id	INTEGER	PRIMARY KEY AUTOINCREMENT	-
code	TEXT	UNIQUE NOT NULL	-
type	TEXT	-	'percent'
value	REAL	NOT NULL	-
min_order	REAL	-	0
max_discount	REAL	-	NULL
usage_limit	INTEGER	-	NULL
used_count	INTEGER	-	0
starts_at	TEXT	-	NULL
expires_at	TEXT	-	NULL
is_active	INTEGER	-	1
created_at	TEXT	-	CURRENT_TIMESTAMP
19. analytics
Column	Type	Constraints	Default
id	INTEGER	PRIMARY KEY AUTOINCREMENT	-
event_type	TEXT	NOT NULL	-
event_name	TEXT	-	NULL
phone	TEXT	-	NULL
order_id	TEXT	-	NULL
product_id	TEXT	-	NULL
campaign_id	TEXT	-	NULL
data	TEXT	-	NULL
created_at	TEXT	-	CURRENT_TIMESTAMP
20. push_subscriptions
Column	Type	Constraints	Default
id	INTEGER	PRIMARY KEY AUTOINCREMENT	-
user_id	TEXT	NOT NULL	-
endpoint	TEXT	NOT NULL	-
p256dh	TEXT	NOT NULL	-
auth	TEXT	NOT NULL	-
is_active	INTEGER	-	1
created_at	TEXT	-	CURRENT_TIMESTAMP
Constraint: UNIQUE(user_id, endpoint)

21. pincodes
Column	Type	Constraints	Default
pincode	TEXT	PRIMARY KEY	-
city	TEXT	-	NULL
state	TEXT	-	NULL
is_serviceable	INTEGER	-	1
cod_available	INTEGER	-	1
delivery_days	INTEGER	-	5
shipping_cost	REAL	-	0
courier_priority	TEXT	-	'[]'
🔑 KEY MAPPINGS (Code → Schema)
Must Use These Names:
❌ WRONG (current code)	✅ CORRECT (schema)
conversations table	chats table
wa_message_id	message_id
conversation_id	❌ Not needed (use phone)
content	text
type	message_type
caption	media_caption
sent_at	timestamp
sessions.flow_data	conversation_state.flow_data
customers.wa_id	❌ Doesn't exist
customers.first_message_at	customers.first_seen
customers.last_message_at	customers.last_seen
📝 Standard SQL Patterns
Insert Message (Correct Way)
SQL

INSERT INTO messages (
  message_id, phone, text, message_type, direction, 
  media_id, media_caption, timestamp, created_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
Get/Create Chat (Correct Way)
SQL

-- Check if exists
SELECT * FROM chats WHERE phone = ?

-- Create new
INSERT INTO chats (phone, customer_name, created_at, updated_at)
VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)

-- Update on new message
UPDATE chats SET 
  last_message = ?,
  last_message_type = ?,
  last_timestamp = ?,
  last_direction = ?,
  unread_count = unread_count + 1,
  total_messages = total_messages + 1,
  updated_at = CURRENT_TIMESTAMP
WHERE phone = ?
Flow State (Correct Way)
SQL

-- Use conversation_state, NOT sessions!
INSERT OR REPLACE INTO conversation_state (
  phone, current_flow, current_step, flow_data, updated_at
) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)

-- Get flow state
SELECT * FROM conversation_state WHERE phone = ?
📊 Indexes Available
SQL

idx_messages_phone        -- ON messages(phone)
idx_messages_timestamp    -- ON messages(timestamp DESC)
idx_orders_phone          -- ON orders(phone)
idx_orders_status         -- ON orders(status)
idx_orders_created        -- ON orders(created_at DESC)
idx_chats_updated         -- ON chats(updated_at DESC)
idx_customers_segment     -- ON customers(segment)
idx_products_category     -- ON products(category)
idx_analytics_event       -- ON analytics(event_type, created_at)