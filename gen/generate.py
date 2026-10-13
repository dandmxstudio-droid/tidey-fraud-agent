"""Synthetic data for the Demo Bank fraud alert agent.

Everything here is fictional: customers, merchants, devices, events and alerts.
Run: python3 generate.py  -> writes ../data/*.json
The answer key goes to ../data/answer_key.json and must never be passed to either agent.
"""
import json, math, os, random
import datetime as dt

random.seed(20261013)
OUT = os.path.join(os.path.dirname(__file__), '..', 'data')
os.makedirs(OUT, exist_ok=True)

ALERT_DAY = dt.datetime(2026, 10, 12)
HIST_START = ALERT_DAY - dt.timedelta(days=90)

CITIES = {
    'Melbourne, FL': (28.08, -80.61), 'Orlando, FL': (28.54, -81.38), 'Tampa, FL': (27.95, -82.46),
    'Miami, FL': (25.76, -80.19), 'Atlanta, GA': (33.75, -84.39), 'Charlotte, NC': (35.23, -80.84),
    'Raleigh, NC': (35.78, -78.64), 'Nashville, TN': (36.16, -86.78), 'Austin, TX': (30.27, -97.74),
    'Dallas, TX': (32.78, -96.80), 'Denver, CO': (39.74, -104.99), 'Chicago, IL': (41.88, -87.63),
    'Columbus, OH': (39.96, -83.00), 'Phoenix, AZ': (33.45, -112.07), 'Seattle, WA': (47.61, -122.33),
    'Portland, OR': (45.52, -122.68), 'New York, NY': (40.71, -74.01), 'Boston, MA': (42.36, -71.06),
    'San Diego, CA': (32.72, -117.16), 'Las Vegas, NV': (36.17, -115.14), 'Sacramento, CA': (38.58, -121.49),
    'Lisbon, Portugal': (38.72, -9.14), 'Toronto, Canada': (43.65, -79.38), 'Cancun, Mexico': (21.16, -86.85),
    'London, UK': (51.51, -0.13),
}
NEARBY = {  # home -> a city 40-90 miles away
    'Melbourne, FL': 'Orlando, FL', 'Tampa, FL': 'Orlando, FL', 'Raleigh, NC': 'Charlotte, NC',
    'Dallas, TX': 'Austin, TX', 'Seattle, WA': 'Portland, OR', 'Orlando, FL': 'Melbourne, FL',
}
HOMES = ['Melbourne, FL', 'Orlando, FL', 'Tampa, FL', 'Atlanta, GA', 'Charlotte, NC', 'Raleigh, NC',
         'Nashville, TN', 'Austin, TX', 'Dallas, TX', 'Denver, CO', 'Chicago, IL', 'Columbus, OH',
         'Phoenix, AZ', 'Seattle, WA', 'New York, NY', 'Boston, MA', 'San Diego, CA', 'Sacramento, CA']
PROXY = 'Unknown (anonymizing proxy)'

MERCHANTS = [
    # id, name, category, online, fraud_reports_90d
    ('M01', 'FreshCart Grocery', 'groceries', False, 0), ('M02', 'Greenleaf Market', 'groceries', False, 0),
    ('M03', 'Sunline Fuel', 'gas', False, 0), ('M04', 'QuickStop Gas', 'gas', False, 1),
    ('M05', 'Harbor Grill', 'restaurant', False, 0), ('M06', 'Noodle Corner', 'restaurant', False, 0),
    ('M07', 'Bean & Bloom Coffee', 'coffee', False, 0), ('M08', 'WellPoint Pharmacy', 'pharmacy', False, 0),
    ('M09', 'StreamBox', 'subscription', True, 0), ('M10', 'CloudDrive Pro', 'subscription', True, 0),
    ('M11', 'Brightwire Electric', 'utilities', True, 0), ('M12', 'Metro Mobile', 'utilities', True, 0),
    ('M13', 'HomeNest Furniture', 'furniture', False, 0), ('M14', 'Outfield Sports', 'sporting goods', False, 0),
    ('M15', 'Pagewise Books', 'books', True, 0), ('M16', 'VoltHub Electronics', 'electronics', True, 2),
    ('M17', 'GadgetVault Online', 'electronics', True, 14), ('M18', 'GiftCardDepot Online', 'gift cards', True, 22),
    ('M19', 'Maison Avery', 'luxury goods', True, 3), ('M20', 'SkyWay Airlines', 'airline', True, 0),
    ('M21', 'Lodgewell Hotels', 'hotel', True, 0), ('M22', 'RideNow', 'rideshare', False, 0),
    ('M23', 'PixelForge Games', 'video games', True, 6), ('M24', 'HelpingHands Donations', 'donations', True, 31),
    ('M25', 'TinyApps Store', 'app store', True, 18), ('M26', 'QuickTip Charity', 'donations', True, 27),
    ('M27', 'Demo Bank ATM', 'atm', False, 0), ('M28', 'Riverside Night Market', 'market vendors', False, 0),
    ('M29', 'Circuit Corner', 'electronics', False, 0), ('M30', 'Oakline Cafe', 'restaurant', False, 0),
    ('M31', 'Casa Lume', 'restaurant', False, 0), ('M32', 'Maple & Main Diner', 'restaurant', False, 0),
    ('M33', 'Mile High Grill', 'restaurant', False, 0), ('M34', 'Playa Azul Restaurant', 'restaurant', False, 0),
]
LOCAL_MEAL = {'Lisbon, Portugal': 'M31', 'Toronto, Canada': 'M32', 'Denver, CO': 'M33', 'Cancun, Mexico': 'M34'}
MERCH = {m[0]: m for m in MERCHANTS}

FIRST = ['Maya', 'Jordan', 'Priya', 'Marcus', 'Elena', 'Devon', 'Aisha', 'Tomas', 'Grace', 'Nikhil', 'Rosa', 'Caleb',
         'Hana', 'Owen', 'Leila', 'Andre', 'Sofia', 'Ben', 'Imani', 'Luca', 'Chloe', 'Rafael', 'Nora', 'Isaac', 'Tara',
         'Felix', 'Amara', 'Diego', 'June', 'Victor', 'Lena', 'Samir', 'Iris', 'Malik', 'Zoe', 'Ethan', 'Ruth', 'Kai',
         'Mei', 'Jonah', 'Alma', 'Theo', 'Nia', 'Gabe', 'Esme', 'Omar', 'Wren', 'Paolo', 'Dana', 'Reid']
LAST = list('ABCDEFGHJKLMNPRSTVWY')
DEVICE_TYPES = ['iPhone', 'Android phone', 'Windows laptop', 'Mac laptop', 'iPad']

customers, transactions, devices, events, prior_alerts, payees, alerts, key = [], [], [], [], [], [], [], []
counters = {'tx': 0, 'dev': 0, 'ev': 0, 'pa': 0, 'py': 0}


def nid(kind, prefix):
    counters[kind] += 1
    return f'{prefix}-{counters[kind]:05d}'


def iso(t):
    return t.replace(microsecond=0).isoformat()


def at(day_offset, hour, minute=0):
    """Time relative to the alert day (day_offset 0 = Oct 12, -1 = Oct 11)."""
    return ALERT_DAY + dt.timedelta(days=day_offset, hours=hour, minutes=minute)


def add_tx(c, t, amount, merchant, channel, city=None, device=None, ip_city=None, status='approved', memo=None, payee=None):
    tx = {'id': nid('tx', 'T'), 'customer_id': c['id'], 'timestamp': iso(t), 'amount': round(amount, 2),
          'merchant_id': merchant, 'channel': channel, 'status': status}
    if channel in ('in_store', 'atm'):
        tx['city'] = city or c['home_city']
    if channel in ('online', 'transfer'):
        tx['device_id'] = device
        tx['ip_city'] = ip_city or c['home_city']
    if memo:
        tx['memo'] = memo
    if payee:
        tx['payee_id'] = payee
    transactions.append(tx)
    return tx


def add_event(c, t, etype, device=None, ip_city=None, details=None):
    ev = {'id': nid('ev', 'E'), 'customer_id': c['id'], 'timestamp': iso(t), 'type': etype,
          'device_id': device, 'ip_city': ip_city or c['home_city']}
    if details:
        ev['details'] = details
    events.append(ev)
    return ev


def add_device(c, label, first_seen, last_seen):
    d = {'id': nid('dev', 'D'), 'customer_id': c['id'], 'label': label, 'first_seen': iso(first_seen), 'last_seen': iso(last_seen)}
    devices.append(d)
    return d['id']


def add_payee(c, name, t):
    p = {'id': nid('py', 'P'), 'customer_id': c['id'], 'name': name, 'added_at': iso(t)}
    payees.append(p)
    return p['id']


def add_prior_alert(c, date, rule, outcome):
    prior_alerts.append({'id': nid('pa', 'PA'), 'customer_id': c['id'], 'date': iso(date), 'rule': rule, 'outcome': outcome})


def new_customer(i, home=None):
    home = home or random.choice(HOMES)
    since = random.randint(2012, 2023)
    c = {'id': f'C-{2001 + i}', 'name': f'{FIRST[i]} {random.choice(LAST)}.', 'home_city': home,
         'customer_since': f'{since}-{random.randint(1, 12):02d}-01', 'account_type': 'Checking account with debit card'}
    customers.append(c)
    # known devices, long-standing
    phone = add_device(c, random.choice(['iPhone', 'Android phone']), dt.datetime(random.randint(max(since, 2021), 2025), random.randint(1, 12), 3), at(-1, 20))
    laptop = add_device(c, random.choice(['Windows laptop', 'Mac laptop']), dt.datetime(random.randint(max(since, 2020), 2025), random.randint(1, 12), 9), at(-random.randint(2, 12), 21)) if random.random() < 0.6 else None
    c['_phone'], c['_laptop'] = phone, laptop
    c['_scale'] = random.choice([0.8, 1.0, 1.2, 1.5])
    return c


def baseline_history(c):
    """~90 days of ordinary activity in the home city on known devices."""
    s = c['_scale']
    for d in range(1, 90):
        t0 = ALERT_DAY - dt.timedelta(days=d)
        r = random.random()
        if r < 0.22:
            add_tx(c, t0 + dt.timedelta(hours=random.randint(9, 19), minutes=random.randint(0, 59)), random.uniform(35, 140) * s, random.choice(['M01', 'M02']), 'in_store')
        elif r < 0.33:
            add_tx(c, t0 + dt.timedelta(hours=random.randint(7, 20), minutes=random.randint(0, 59)), random.uniform(28, 62), random.choice(['M03', 'M04']), 'in_store')
        elif r < 0.50:
            add_tx(c, t0 + dt.timedelta(hours=random.choice([8, 12, 13, 18, 19, 20]), minutes=random.randint(0, 59)), random.uniform(9, 65) * s, random.choice(['M05', 'M06', 'M07', 'M30']), 'in_store')
        elif r < 0.55:
            add_tx(c, t0 + dt.timedelta(hours=random.randint(10, 18)), random.uniform(12, 48), 'M08', 'in_store')
        elif r < 0.57:
            add_tx(c, t0 + dt.timedelta(hours=random.randint(19, 22), minutes=random.randint(0, 59)), random.uniform(14, 60) * s, 'M15', 'online', device=random.choice([x for x in [c['_phone'], c['_laptop']] if x]))
        elif r < 0.60:
            add_tx(c, t0 + dt.timedelta(hours=random.randint(10, 18), minutes=random.randint(0, 59)), random.uniform(25, 90) * s, 'M14', 'in_store')
    stream, phone_bill = random.random() < 0.7, random.choice([45.00, 55.00, 65.00, 80.00])
    bill_day, bill_hr = random.randint(3, 12), random.randint(5, 9)
    for m in range(3):  # monthly bills / subscriptions
        t0 = ALERT_DAY - dt.timedelta(days=bill_day + 30 * m)
        if stream:
            add_tx(c, t0 + dt.timedelta(hours=bill_hr, minutes=random.randint(0, 59)), 15.99, 'M09', 'online', device=c['_phone'], memo='Monthly plan')
        add_tx(c, t0 + dt.timedelta(days=random.randint(1, 4), hours=bill_hr + 1, minutes=random.randint(0, 59)), random.uniform(70, 170), 'M11', 'online', device=c['_laptop'] or c['_phone'], memo='Autopay')
        add_tx(c, t0 + dt.timedelta(days=random.randint(5, 9), hours=bill_hr + 1, minutes=random.randint(0, 59)), phone_bill, 'M12', 'online', device=c['_laptop'] or c['_phone'], memo='Autopay')
    login_days = random.sample(range(1, 88), random.randint(4, 7))
    for dd in sorted(login_days, reverse=True):  # online banking logins from known devices at home
        add_event(c, ALERT_DAY - dt.timedelta(days=dd) + dt.timedelta(hours=random.randint(8, 21), minutes=random.randint(0, 59)), 'login', device=random.choice([x for x in [c['_phone'], c['_laptop']] if x]))


def clear_home_activity(c, start):
    """Customer is away from home from `start`: drop ordinary in-person activity at home after that."""
    s0 = iso(start)
    transactions[:] = [t for t in transactions if not (t['customer_id'] == c['id'] and t['channel'] in ('in_store', 'atm') and t.get('city') == c['home_city'] and t['timestamp'] >= s0)]


def signin(c, t, device, details=None):
    add_event(c, t, 'login', device=device, details=details)


def alert(c, rule, trigger_type, ids, what, amount, t):
    a = {'customer_id': c['id'], 'created_at': iso(t + dt.timedelta(minutes=2)), 'rule_triggered': rule,
         'trigger': {'type': trigger_type, 'ids': ids}, 'what_happened': what, 'amount': round(amount, 2)}
    alerts.append(a)
    return a


def answer(a, label, needs_human, why, leans=None):
    a['_key'] = {'label': label, 'needs_human': needs_human,
                 'expected_action': 'analyst' if needs_human else ('close' if label == 'legitimate' else 'escalate'),
                 'why': why}
    if leans:
        a['_key']['leans'] = leans


# ---------------------------------------------------------------- scenarios
i = 0


def cust(home=None):
    global i
    c = new_customer(i, home)
    i += 1
    baseline_history(c)
    return c


# ---- LEGITIMATE (24)
for dest, home in [('Lisbon, Portugal', 'Boston, MA'), ('Toronto, Canada', 'Chicago, IL'), ('Denver, CO', 'Atlanta, GA')]:
    c = cust(home)
    add_tx(c, at(-random.randint(18, 30), 20, 14), random.uniform(380, 720), 'M20', 'online', device=c['_phone'], memo=f'Flight to {dest.split(",")[0]}, Oct 9-17')
    add_tx(c, at(-random.randint(12, 17), 21, 2), random.uniform(450, 900), 'M21', 'online', device=c['_laptop'] or c['_phone'], memo=f'Hotel in {dest.split(",")[0]}, Oct 9-17')
    clear_home_activity(c, at(-3, 6))
    add_tx(c, at(-2, 16, 40), random.uniform(28, 60), 'M22', 'in_store', city=dest)
    add_tx(c, at(-1, 13, 5), random.uniform(25, 70), LOCAL_MEAL[dest], 'in_store', city=dest)
    t = at(0, 15, 22)
    tx = add_tx(c, t, random.uniform(240, 520), random.choice(['M14', 'M29']), 'in_store', city=dest)
    a = alert(c, 'Transaction far from home', 'transaction', [tx['id']], f"${tx['amount']:,.0f} in-store purchase in {dest}", tx['amount'], t)
    answer(a, 'legitimate', False, 'Customer booked a flight and hotel for this city and has been spending there for two days.')

for merchant, amt, prior in [('M13', 1850, 920), ('M14', 1120, 380), ('M29', 1460, 610)]:
    c = cust()
    add_tx(c, at(-random.randint(40, 70), 14, 10), prior, merchant, 'in_store', memo=None)
    t = at(0, 13, 48)
    tx = add_tx(c, t, amt * c['_scale'] / 1.0, merchant, 'in_store')
    a = alert(c, 'Amount over 10x customer average', 'transaction', [tx['id']], f"${tx['amount']:,.0f} in-store purchase at {MERCH[merchant][1]}", tx['amount'], t)
    answer(a, 'legitimate', False, 'In-store, home city, a store the customer has bought from before. A large but normal purchase.')

for _ in range(3):
    c = cust()
    newdev = add_device(c, random.choice(['iPhone', 'Android phone']), at(0, 9, 5), at(0, 18))
    add_event(c, at(0, 9, 5), 'login', device=newdev, details='New device sign-in passed two-factor check sent to phone number on file')
    for d in [d for d in devices if d['id'] == c['_phone']]:
        d['last_seen'] = iso(at(-1, 22, 10))
    t = at(0, 19, 31)
    tx = add_tx(c, t, random.uniform(24, 62), 'M15', 'online', device=newdev)
    a = alert(c, 'Purchase from a device not seen before', 'transaction', [tx['id']], f"${tx['amount']:,.0f} online purchase at Pagewise Books from a new device", tx['amount'], t)
    answer(a, 'legitimate', False, 'New phone signed in from home with a passed two-factor check; old phone stopped being used; usual merchant and amount.')

for _ in range(2):
    c = cust()
    ids = []
    t0 = at(0, 19, 5)
    for k in range(6):
        tx = add_tx(c, t0 + dt.timedelta(minutes=4 * k + random.randint(0, 2)), random.uniform(7, 34), 'M28', 'in_store')
        ids.append(tx['id'])
    a = alert(c, '5+ transactions within 30 minutes', 'transactions', ids, '6 in-store purchases at Riverside Night Market in 25 minutes', sum(x['amount'] for x in transactions if x['id'] in ids), t0 + dt.timedelta(minutes=24))
    answer(a, 'legitimate', False, 'Small in-person purchases at a night market in the home city, card present.')

for _ in range(2):
    c = cust()
    add_prior_alert(c, dt.datetime(2025, 10, 11), 'Online charge from merchant not used in 90 days', 'legitimate')
    t = at(0, 6, 0)
    tx = add_tx(c, t, 119.00, 'M10', 'online', device=c['_phone'], memo='Annual plan renewal')
    a = alert(c, 'Online charge from merchant not used in 90 days', 'transaction', [tx['id']], '$119 online charge at CloudDrive Pro', 119.0, t)
    answer(a, 'legitimate', False, 'Annual renewal: the same charge was flagged a year ago and confirmed legitimate.')

for landlord in ['Oakview Property Mgmt', 'Lakeside Residences LLC']:
    c = cust()
    old = add_payee(c, 'Pinecrest Apartments', dt.datetime(2024, 2, 1))
    for m in [3, 2]:
        add_tx(c, at(-30 * m + 2, 9), 1600.00, None, 'transfer', device=c['_phone'], payee=old, memo='Rent')
    add_event(c, at(-1, 10, 15), 'branch_verified_call', device=None, details='Customer called; identity verified by phone agent; password reset requested by customer')
    add_event(c, at(-1, 10, 20), 'password_reset', device=c['_phone'], details='Reset link used on known phone')
    signin(c, at(-1, 10, 22), c['_phone'], 'Signed in after password reset')
    signin(c, at(0, 8, 36), c['_phone'])
    p = add_payee(c, landlord, at(0, 8, 40))
    add_event(c, at(0, 8, 40), 'payee_added', device=c['_phone'], details=f'Payee: {landlord}')
    t = at(0, 8, 52)
    tx = add_tx(c, t, 1650.00, None, 'transfer', device=c['_phone'], payee=p, memo='October rent - new apartment')
    a = alert(c, 'New payee added within 24h of password reset', 'transaction', [tx['id']], f'$1,650 transfer to new payee {landlord}', 1650.0, t)
    answer(a, 'legitimate', False, 'Reset requested by the verified customer, done on their own phone at home; rent amount matches past rent payments.')

for home in ['Melbourne, FL', 'Raleigh, NC']:
    c = cust(home)
    near = NEARBY[home]
    add_tx(c, at(-34, 12, 10), 42.5, 'M05', 'in_store', city=near)
    add_tx(c, at(-12, 17, 30), 38.2, 'M03', 'in_store', city=near)
    t = at(0, 11, 20)
    tx = add_tx(c, t, random.uniform(55, 120), 'M01', 'in_store', city=near)
    a = alert(c, 'Transaction far from home', 'transaction', [tx['id']], f"${tx['amount']:,.0f} grocery purchase in {near}", tx['amount'], t)
    answer(a, 'legitimate', False, 'A nearby city the customer visits regularly; ordinary amount, card present.')

for amt in [289, 365, 448]:
    c = cust()
    add_tx(c, at(-random.randint(30, 80), 20, 30), random.uniform(120, 220), 'M16', 'online', device=c['_laptop'] or c['_phone'])
    t = at(0, 20, 12)
    tx = add_tx(c, t, amt, 'M16', 'online', device=c['_laptop'] or c['_phone'])
    a = alert(c, 'Online purchase over 4x customer average', 'transaction', [tx['id']], f'${amt} online purchase at VoltHub Electronics', amt, t)
    answer(a, 'legitimate', False, 'Known device, home location, evening, a merchant the customer has used before.')

for amt in [400, 600]:
    c = cust()
    add_tx(c, at(-33, 17, 45), 300, 'M27', 'atm')
    t = at(0, 17, 10)
    tx = add_tx(c, t, amt, 'M27', 'atm')
    a = alert(c, 'Large ATM withdrawal', 'transaction', [tx['id']], f'${amt} ATM withdrawal', amt, t)
    answer(a, 'legitimate', False, 'Bank ATM in the home city with the physical card; similar withdrawal last month.')

for au_city, who in [('Austin, TX', 'daughter'), ('Seattle, WA', 'son')]:
    c = cust(random.choice([h for h in HOMES if h not in (au_city,)]))
    c['account_type'] = 'Credit card'
    last4 = random.randint(1000, 9999)
    signin(c, at(-21, 10, 52), c['_phone'])
    add_event(c, at(-21, 11), 'authorized_user_added', device=c['_phone'], details=f'Authorized user added: {who}, lives in {au_city}; second card ending {last4} issued')
    for d in [-15, -9, -4]:
        add_tx(c, at(d, random.randint(10, 18), random.randint(0, 59)), random.uniform(18, 75), random.choice(['M01', 'M07', 'M03']), 'in_store', city=au_city, memo=f'Card ending {last4} (authorized user)')
    t = at(0, 14, 2)
    tx = add_tx(c, t, random.uniform(150, 260), 'M14', 'in_store', city=au_city, memo=f'Card ending {last4} (authorized user)')
    a = alert(c, 'Transaction far from home', 'transaction', [tx['id']], f"${tx['amount']:,.0f} in-store purchase in {au_city}", tx['amount'], t)
    answer(a, 'legitimate', False, f'Made on the authorized user card of the customer\'s {who}, who lives in that city and shops there regularly.')

# ---- CARD-NOT-PRESENT FRAUD (8)
cnp = [('M17', 1240, 'Las Vegas, NV', 2), ('M18', 500, PROXY, 3), ('M19', 2380, 'Phoenix, AZ', 1), ('M17', 899, PROXY, 4),
       ('M18', 750, 'Dallas, TX', 2), ('M16', 1640, 'New York, NY', 3), ('M19', 1890, PROXY, 1), ('M17', 1175, 'Sacramento, CA', 2)]
for merchant, amt, ipc, hr in cnp:
    c = cust()
    if ipc not in (PROXY,) and ipc == c['home_city']:
        ipc = 'Las Vegas, NV'
    mm = random.randint(0, 40)
    fp = add_device(c, 'Unrecognized browser', at(0, hr, 3 + mm), at(0, hr, 20 + mm))
    t = at(0, hr, 14 + mm)
    ids = []
    if random.random() < 0.5:
        d1 = add_tx(c, t - dt.timedelta(minutes=6), amt * 1.6, merchant, 'online', device=fp, ip_city=ipc, status='declined')
        ids.append(d1['id'])
    tx = add_tx(c, t, amt, merchant, 'online', device=fp, ip_city=ipc)
    ids.append(tx['id'])
    a = alert(c, 'Unusual online purchase: new device, high amount', 'transactions' if len(ids) > 1 else 'transaction', ids, f'${amt:,} online purchase at {MERCH[merchant][1]}', amt, t)
    answer(a, 'card_not_present_fraud', False, 'Card details used online from a device and location never seen, in the middle of the night, at a merchant with fraud reports the customer never used.')

# ---- ACCOUNT TAKEOVER (5)
ato = [(3900, 'Las Vegas, NV', 'phone'), (6800, PROXY, 'email'), (2500, 'Phoenix, AZ', 'email'), (4750, PROXY, 'phone'), (3150, 'Columbus, OH', 'email')]
for amt, ipc, changed in ato:
    c = cust()
    if ipc == c['home_city']:
        ipc = PROXY
    h0 = random.choice([0, 1, 2, 3])
    base = at(0, h0, random.randint(0, 50))
    step = lambda m: base + dt.timedelta(minutes=m)
    gaps = sorted(random.sample(range(2, 30), 4))
    bad = add_device(c, random.choice(['Windows laptop', 'Android phone']), base, step(gaps[3] + 5))
    add_event(c, base, 'login', device=bad, ip_city=ipc, details=random.choice(['Sign-in from new device; two-factor code entered after 3 failed attempts', 'Sign-in from new device; two-factor code entered on first try']))
    add_event(c, step(gaps[0]), 'password_reset', device=bad, ip_city=ipc)
    add_event(c, step(gaps[1]), f'{changed}_changed', device=bad, ip_city=ipc, details=f'{changed.title()} on file replaced')
    name = random.choice(['J. Carter', 'R. Holloway', 'M. Brandt', 'S. Okafor', 'T. Lindqvist'])
    p = add_payee(c, name, step(gaps[2]))
    add_event(c, step(gaps[2]), 'payee_added', device=bad, ip_city=ipc, details=f'Payee: {name}')
    t = step(gaps[3])
    tx = add_tx(c, t, amt, None, 'transfer', device=bad, ip_city=ipc, payee=p)
    a = alert(c, 'New payee added within 24h of password reset', 'transaction', [tx['id']], f'Password reset, new payee, ${amt:,} transfer', amt, t)
    answer(a, 'account_takeover', False, 'Within 25 minutes a new device signed in, reset the password, changed contact details, added a payee and sent money.')

# ---- CARD TESTING (5)
for n, followup in [(6, ('M17', 899, 'declined')), (5, None), (7, ('M18', 250, 'declined')), (5, ('M17', 649, 'declined')), (4, ('M16', 49, 'approved'))]:
    c = cust()
    fp = add_device(c, 'Unrecognized browser', at(0, 3, 40), at(0, 3, 55))
    t0 = at(0, 3, 41)
    ids = []
    for k in range(n):
        tx = add_tx(c, t0 + dt.timedelta(seconds=55 * k + random.randint(0, 20)), random.choice([1.00, 1.50, 2.00, 2.99, 3.00, 4.99]), random.choice(['M24', 'M25', 'M26']), 'online', device=fp, ip_city=PROXY)
        ids.append(tx['id'])
    if followup:
        m, amt, st = followup
        tx = add_tx(c, t0 + dt.timedelta(minutes=n + 2), amt, m, 'online', device=fp, ip_city=PROXY, status=st)
        ids.append(tx['id'])
    total = sum(x['amount'] for x in transactions if x['id'] in ids and x['status'] == 'approved')
    a = alert(c, '5+ transactions within 10 minutes' if n >= 5 else 'Several small online charges in minutes', 'transactions', ids, f'{n} tiny online charges in {n} minutes' + (', then a larger attempt' if followup else ''), total, t0 + dt.timedelta(minutes=n + 3))
    answer(a, 'card_testing', False, 'Tiny charges seconds apart at small merchants with fraud reports, from an unrecognized device behind a proxy: someone checking that stolen card details work.')

# ---- NEEDS A PERSON (8): mixed signals, should not be auto-closed
c = cust()
nd = add_device(c, 'Unrecognized browser', at(0, 21, 2), at(0, 21, 20))
t = at(0, 21, 9)
tx = add_tx(c, t, 1380, 'M16', 'online', device=nd)
a = alert(c, 'Amount over 10x customer average', 'transaction', [tx['id']], '$1,380 online purchase at VoltHub Electronics', 1380, t)
answer(a, 'unclear', True, 'Home location and a reasonable evening hour, but a device never seen and an unusually large amount with no history at this merchant.', leans='legitimate')

c = cust('Miami, FL')
add_tx(c, at(-1, 6, 10), 34.0, 'M22', 'in_store', city='Miami, FL', memo='Ride to MIA airport')
clear_home_activity(c, at(-1, 6, 11))
t = at(0, 16, 30)
tx = add_tx(c, t, 240, 'M34', 'in_store', city='Cancun, Mexico')
a = alert(c, 'Transaction far from home', 'transaction', [tx['id']], '$240 in-store purchase in Cancun, Mexico', 240, t)
answer(a, 'unclear', True, 'A ride to the airport yesterday hints at travel, but there is no flight or hotel booking on this account.', leans='legitimate')

c = cust()
add_event(c, at(0, 1, 2), 'password_reset', device=c['_phone'], details='Reset link used on known phone')
signin(c, at(0, 1, 4), c['_phone'], 'Signed in after password reset')
p = add_payee(c, 'D. Whitfield', at(0, 1, 9))
add_event(c, at(0, 1, 9), 'payee_added', device=c['_phone'], details='Payee: D. Whitfield')
t = at(0, 1, 15)
tx = add_tx(c, t, 4200, None, 'transfer', device=c['_phone'], payee=p, memo='urgent - investment deposit')
a = alert(c, 'New payee added within 24h of password reset', 'transaction', [tx['id']], 'Password reset, new payee, $4,200 transfer', 4200, t)
answer(a, 'unclear', True, "Done on the customer's own phone, so not a classic takeover, but a 1 AM reset, a new payee and an 'urgent investment' transfer fit a scam the customer may be under.", leans='fraud (scam)')

c = cust()
c['account_type'] = 'Credit card'
add_event(c, dt.datetime(2025, 8, 14, 15), 'authorized_user_added', device=c['_phone'], details='Authorized user added: son; second card issued')
ids = []
t0 = at(0, 16, 20)
for k, amt in enumerate([4.99, 9.99, 4.99, 19.99]):
    tx = add_tx(c, t0 + dt.timedelta(minutes=2 * k), amt, 'M23', 'online', device=c['_laptop'] or c['_phone'])
    ids.append(tx['id'])
a = alert(c, 'Several small online charges in minutes', 'transactions', ids, '4 small charges at PixelForge Games in 6 minutes', 39.96, t0 + dt.timedelta(minutes=6))
answer(a, 'unclear', True, 'Looks like card testing at first glance, but it is on a known device at home and the account has a younger authorized user who may be buying in-game items.', leans='legitimate')

c = cust()
t = at(0, 19, 4)
tx = add_tx(c, t, 200, 'M18', 'online', device=c['_phone'])
a = alert(c, 'Merchant with recent fraud reports', 'transaction', [tx['id']], '$200 online purchase at GiftCardDepot Online', 200, t)
answer(a, 'unclear', True, 'Known phone at home, but gift cards from a merchant with many fraud reports are a common scam payout; worth a quick call.', leans='legitimate')

c = cust()
add_tx(c, at(-20, 21), 512, 'M21', 'online', device=c['_phone'], memo='Hotel booking, 3 nights')
t = at(0, 22, 40)
tx = add_tx(c, t, 500, 'M27', 'atm', city='Nashville, TN' if c['home_city'] != 'Nashville, TN' else 'Atlanta, GA')
a = alert(c, 'Large ATM withdrawal', 'transaction', [tx['id']], f"$500 ATM withdrawal in {tx['city']}", 500, t)
answer(a, 'unclear', True, 'Physical card used, and a recent hotel booking hints at travel, but the booking does not say where and the customer has never been seen in this city.', leans='legitimate')

c = cust()
signin(c, at(-1, 18, 26), c['_laptop'] or c['_phone'])
add_event(c, at(-1, 18, 30), 'mailing_address_changed', device=c['_laptop'] or c['_phone'], details='Mailing address changed to an address in Las Vegas, NV')
t = at(0, 12, 15)
tx = add_tx(c, t, 2900, 'M19', 'online', device=c['_laptop'] or c['_phone'])
a = alert(c, 'Amount over 10x customer average', 'transaction', [tx['id']], '$2,900 online purchase at Maison Avery', 2900, t)
answer(a, 'unclear', True, "Known device and home location, but the mailing address was changed to another state yesterday, followed by a luxury purchase far above the customer's normal spending.", leans='fraud')

c = cust()
signin(c, at(0, 10, 2), c['_phone'])
add_event(c, at(0, 10, 5), 'email_changed', device=c['_phone'], details='Email on file replaced')
t = at(0, 10, 48)
tx = add_tx(c, t, 350, 'M19', 'online', device=c['_phone'])
a = alert(c, 'Contact details changed, then a purchase', 'transaction', [tx['id']], 'Email changed, then $350 online purchase at Maison Avery', 350, t)
answer(a, 'unclear', True, 'Changed on the known phone at a normal hour, but a contact change followed by a first purchase at a new merchant is a common takeover pattern.', leans='legitimate')

# ---- realism: some customers have past alerts (unrelated to today's activity)
have_prior = {p['customer_id'] for p in prior_alerts}
pool = [c for c in customers if c['id'] not in have_prior]
for c in random.sample(pool, 14):
    add_prior_alert(c, dt.datetime(random.choice([2023, 2024, 2025]), random.randint(1, 12), random.randint(1, 28), random.randint(9, 20)),
                    random.choice(['Transaction far from home', 'Amount over 10x customer average', 'Large ATM withdrawal', 'Purchase from a device not seen before']), 'legitimate')
for c in random.sample([c for c in pool if not any(p['customer_id'] == c['id'] for p in prior_alerts)], 3):
    add_prior_alert(c, dt.datetime(2024, random.randint(1, 12), random.randint(1, 28), 14), 'Unusual online purchase: new device, high amount', 'fraud (card replaced)')
prior_alerts.sort(key=lambda x: (x['customer_id'], x['date']))

# ---------------------------------------------------------------- finalize
random.shuffle(alerts)
for n, a in enumerate(alerts):
    a['id'] = f'A-{1001 + n}'
alerts.sort(key=lambda a: a['id'])
for a in alerts:
    k = a.pop('_key')
    key.append({'alert_id': a['id'], **k})

for c in customers:
    c.pop('_phone'); c.pop('_laptop'); c.pop('_scale')

transactions.sort(key=lambda x: (x['customer_id'], x['timestamp']))
events.sort(key=lambda x: (x['customer_id'], x['timestamp']))
merchants = [{'id': m[0], 'name': m[1], 'category': m[2], 'online': m[3], 'fraud_reports_90d': m[4]} for m in MERCHANTS]
cities = [{'name': k, 'lat': v[0], 'lon': v[1]} for k, v in CITIES.items()]
alerts = [{'id': a['id'], **{k: v for k, v in a.items() if k != 'id'}} for a in alerts]


def dump(name, obj):
    with open(os.path.join(OUT, name), 'w') as f:
        json.dump(obj, f, indent=1)


dump('customers.json', customers)
dump('transactions.json', transactions)
dump('devices.json', devices)
dump('security_events.json', events)
dump('payees.json', payees)
dump('prior_alerts.json', prior_alerts)
dump('merchants.json', merchants)
dump('cities.json', cities)
dump('alerts.json', alerts)
dump('answer_key.json', key)

from collections import Counter
print('customers', len(customers), 'transactions', len(transactions), 'devices', len(devices), 'events', len(events))
print('alerts', len(alerts), Counter(k['label'] for k in key), Counter(k['expected_action'] for k in key))
