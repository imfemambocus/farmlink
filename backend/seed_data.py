from sqlalchemy.orm import Session
from sqlalchemy import text
from core.database import SessionLocal, engine
from models.user import User, FarmerProfile, IndividualProfile, BusinessProfile
from models.product import FarmerProduct, ProductUnitPrice, ItemEnum, UnitEnum, CustomerTypeEnum
from models.order import UnifiedOrder, UnifiedOrderItem, UnifiedPayment, FarmerPayment, OrderStatusEnum, \
    PaymentStatusEnum, PaymentMethodEnum
from models.notification import Notification, DeviceToken, NotificationTypeEnum, UnifiedOrderFarmerStatus
from core.security import get_password_hash
from datetime import datetime, timedelta
import random
import json


# Password: testing (for all test users)
DEFAULT_PASSWORD = "testing"


# Mauritius data
MAURITIUS_LOCATIONS = [
    {"street": "Royal Road", "city": "Port Louis", "post_code": "11328"},
    {"street": "Sir William Newton Street", "city": "Port Louis", "post_code": "11302"},
    {"street": "La Chaussée", "city": "Port Louis", "post_code": "11304"},
    {"street": "Coastal Road", "city": "Flic en Flac", "post_code": "90537"},
    {"street": "Royal Road", "city": "Grand Baie", "post_code": "30501"},
    {"street": "Avenue des Cocotiers", "city": "Trou aux Biches", "post_code": "22201"},
    {"street": "St Jean Road", "city": "Quatre Bornes", "post_code": "72201"},
    {"street": "Avenue de la Paix", "city": "Vacoas", "post_code": "73403"},
    {"street": "Royal Road", "city": "Rose Hill", "post_code": "71259"},
    {"street": "Avenue Leconte de Lisle", "city": "Curepipe", "post_code": "74201"},
    {"street": "Coastal Road", "city": "Tamarin", "post_code": "90903"},
    {"street": "Sir Virgil Naz Street", "city": "Mahebourg", "post_code": "50801"},
    {"street": "Avenue des Salines", "city": "Centre de Flacq", "post_code": "40701"},
    {"street": "Avenue Jean Paul II", "city": "Floreal", "post_code": "74001"},
    {"street": "Sir Arthur Raman Street", "city": "Triolet", "post_code": "21201"},
]


MAURITIUS_DISTRICTS = [
    "Port Louis", "Black River", "Flacq", "Grand Port", "Moka",
    "Pamplemousses", "Plaines Wilhems", "Rivière du Rempart", "Savanne"
]


def reset_database(db: Session):
    print("🗑️  Resetting database...")

    try:
        from core.database import Base

        # STEP 1: Get all existing tables from database
        print("  - Scanning existing tables...")
        result = db.execute(text("""
                                 SELECT name
                                 FROM sqlite_master
                                 WHERE type = 'table'
                                   AND name NOT LIKE 'sqlite_%'
                                 ORDER BY name
                                 """))
        existing_tables = [row[0] for row in result]
        print(f"    Found {len(existing_tables)} existing tables")

        # STEP 2: Get all model tables from current models
        model_tables = set(Base.metadata.tables.keys())
        print(f"    Current models define {len(model_tables)} tables")

        # STEP 3: Find orphaned tables (exist in DB but not in models)
        orphaned_tables = set(existing_tables) - model_tables
        if orphaned_tables:
            print(f"  - Removing {len(orphaned_tables)} orphaned tables...")
            for table in orphaned_tables:
                try:
                    db.execute(text(f"DROP TABLE IF EXISTS {table}"))
                    print(f"    ✅ Removed orphaned table: {table}")
                except Exception as e:
                    print(f"    ⚠️  Could not remove {table}: {e}")

        # STEP 4: Drop all remaining tables to ensure clean slate
        print("  - Dropping all remaining tables...")
        Base.metadata.drop_all(bind=engine)

        # STEP 5: Create all tables from current models
        print("  - Creating tables from current models...")
        Base.metadata.create_all(bind=engine)

        # STEP 6: Verify final table structure
        print("  - Verifying final table structure...")
        result = db.execute(text("""
                                 SELECT name
                                 FROM sqlite_master
                                 WHERE type = 'table'
                                   AND name NOT LIKE 'sqlite_%'
                                 ORDER BY name
                                 """))

        final_tables = [row[0] for row in result]
        print(f"    📋 Final database has {len(final_tables)} tables")

        db.commit()
        print("✅ Database cleanup and schema update completed!")

    except Exception as e:
        print(f"❌ Error during database reset: {e}")
        db.rollback()
        raise


def create_test_users(db: Session):
    print("\n👥 Creating main test users...")

    # Main Individual User
    individual_user = User(
        email="individual@test.com",
        hashed_password=get_password_hash(DEFAULT_PASSWORD),
        role="individual"
    )
    db.add(individual_user)
    db.flush()

    location = random.choice(MAURITIUS_LOCATIONS)
    individual_profile = IndividualProfile(
        user_id=individual_user.id,
        first_name="Isfaaq",
        last_name="Emambocus",
        date_of_birth="1997-12-08",
        phone_number="58173526",
        street=location["street"],
        city_town=location["city"],
        post_code=location["post_code"]
    )
    db.add(individual_profile)
    print("Created individual user: individual@test.com")

    # Main Business User
    business_user = User(
        email="business@test.com",
        hashed_password=get_password_hash(DEFAULT_PASSWORD),
        role="business"
    )
    db.add(business_user)
    db.flush()

    location = random.choice(MAURITIUS_LOCATIONS)
    business_profile = BusinessProfile(
        user_id=business_user.id,
        business_name="Tropical Delights Ltd",
        contact_name="Raj Patel",
        phone_number="52987654",
        street=location["street"],
        city_town=location["city"],
        post_code=location["post_code"]
    )
    db.add(business_profile)
    print("Created business user: business@test.com")

    # Main Farmer User (with ALL products)
    farmer_user = User(
        email="farmer@test.com",
        hashed_password=get_password_hash(DEFAULT_PASSWORD),
        role="farmer"
    )
    db.add(farmer_user)
    db.flush()

    farmer_profile = FarmerProfile(
        user_id=farmer_user.id,
        first_name="Kumar",
        last_name="Seebaluck",
        phone_number="59876543",
        district=random.choice(MAURITIUS_DISTRICTS)
    )
    db.add(farmer_profile)
    print("Created farmer user: farmer@test.com")

    return individual_user.id, business_user.id, farmer_user.id


def create_additional_users(db: Session):
    print("\n👥 Creating additional test users...")

    # Additional Individual Users
    individual_names = [
        ("Priya", "Devi"), ("Faizal", "Khodabux"), ("Anita", "Boolell"), ("Yasin", "Patel")
    ]

    for first_name, last_name in individual_names:
        user = User(
            email=f"{first_name.lower()}@test.com",
            hashed_password=get_password_hash(DEFAULT_PASSWORD),
            role="individual"
        )
        db.add(user)
        db.flush()

        location = random.choice(MAURITIUS_LOCATIONS)
        profile = IndividualProfile(
            user_id=user.id,
            first_name=first_name,
            last_name=last_name,
            date_of_birth=f"198{random.randint(5, 9)}-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}",
            phone_number=f"5{random.randint(1000000, 9999999)}",
            street=location["street"],
            city_town=location["city"],
            post_code=location["post_code"]
        )
        db.add(profile)
        print(f"Created {first_name.lower()}@test.com")

    # Additional Business Users
    business_data = [
        ("Fresh Market Co", "Lisa", "Chen"),
        ("Halal Foods Ltd", "Ahmed", "Joomun"),
        ("Paradise Foods", "Marie", "Lalanne"),
        ("Ocean View Supplies", "Zara", "Gupta")
    ]

    for business_name, first_name, last_name in business_data:
        user = User(
            email=f"{first_name.lower()}@test.com",
            hashed_password=get_password_hash(DEFAULT_PASSWORD),
            role="business"
        )
        db.add(user)
        db.flush()

        location = random.choice(MAURITIUS_LOCATIONS)
        profile = BusinessProfile(
            user_id=user.id,
            business_name=business_name,
            contact_name=f"{first_name} {last_name}",
            phone_number=f"5{random.randint(1000000, 9999999)}",
            street=location["street"],
            city_town=location["city"],
            post_code=location["post_code"]
        )
        db.add(profile)
        print(f"Created {first_name.lower()}@test.com")

    # Additional Farmer Users
    farmer_names = [
        ("Roshan", "Appadoo"), ("Nisha", "Ramdin"), ("Ibrahim", "Sooklall"), ("Kavitha", "Bheenick")
    ]

    farmer_ids = []
    for first_name, last_name in farmer_names:
        user = User(
            email=f"{first_name.lower()}@test.com",
            hashed_password=get_password_hash(DEFAULT_PASSWORD),
            role="farmer"
        )
        db.add(user)
        db.flush()

        profile = FarmerProfile(
            user_id=user.id,
            first_name=first_name,
            last_name=last_name,
            phone_number=f"5{random.randint(1000000, 9999999)}",
            district=random.choice(MAURITIUS_DISTRICTS)
        )
        db.add(profile)
        farmer_ids.append(user.id)
        print(f"Created {first_name.lower()}@test.com")

    return farmer_ids


def create_all_products(db: Session, farmer_id: int):
    product_pricing = {
        # FRUITS
        ItemEnum.APPLE: {"individual": 450.0, "business": 400.0, "unit": UnitEnum.KG, "stock": 100},
        ItemEnum.BANANA: {"individual": 180.0, "business": 160.0, "unit": UnitEnum.DOZEN, "stock": 80},
        ItemEnum.ORANGE: {"individual": 350.0, "business": 320.0, "unit": UnitEnum.KG, "stock": 90},
        ItemEnum.MANGO: {"individual": 500.0, "business": 450.0, "unit": UnitEnum.KG, "stock": 60},
        ItemEnum.PINEAPPLE: {"individual": 250.0, "business": 220.0, "unit": UnitEnum.PIECE, "stock": 40},
        ItemEnum.PAPAYA: {"individual": 300.0, "business": 270.0, "unit": UnitEnum.KG, "stock": 50},
        ItemEnum.GUAVA: {"individual": 200.0, "business": 180.0, "unit": UnitEnum.KG, "stock": 70},
        ItemEnum.LYCHEE: {"individual": 600.0, "business": 550.0, "unit": UnitEnum.KG, "stock": 30},
        ItemEnum.COCONUT: {"individual": 80.0, "business": 70.0, "unit": UnitEnum.PIECE, "stock": 100},
        ItemEnum.LEMON: {"individual": 400.0, "business": 360.0, "unit": UnitEnum.KG, "stock": 60},
        ItemEnum.LIME: {"individual": 350.0, "business": 320.0, "unit": UnitEnum.KG, "stock": 80},
        ItemEnum.WATERMELON: {"individual": 150.0, "business": 130.0, "unit": UnitEnum.KG, "stock": 40},
        ItemEnum.MELON: {"individual": 250.0, "business": 220.0, "unit": UnitEnum.KG, "stock": 50},
        ItemEnum.GRAPES: {"individual": 800.0, "business": 720.0, "unit": UnitEnum.KG, "stock": 25},
        ItemEnum.STRAWBERRY: {"individual": 1200.0, "business": 1000.0, "unit": UnitEnum.KG, "stock": 15},

        # VEGETABLES
        ItemEnum.TOMATO: {"individual": 350.0, "business": 320.0, "unit": UnitEnum.KG, "stock": 120},
        ItemEnum.POTATO: {"individual": 200.0, "business": 180.0, "unit": UnitEnum.KG, "stock": 200},
        ItemEnum.ONION: {"individual": 300.0, "business": 270.0, "unit": UnitEnum.KG, "stock": 150},
        ItemEnum.CARROT: {"individual": 280.0, "business": 250.0, "unit": UnitEnum.KG, "stock": 100},
        ItemEnum.CABBAGE: {"individual": 150.0, "business": 130.0, "unit": UnitEnum.PIECE, "stock": 80},
        ItemEnum.LETTUCE: {"individual": 200.0, "business": 180.0, "unit": UnitEnum.PIECE, "stock": 60},
        ItemEnum.SPINACH: {"individual": 250.0, "business": 220.0, "unit": UnitEnum.BUNCH, "stock": 70},
        ItemEnum.BROCCOLI: {"individual": 400.0, "business": 360.0, "unit": UnitEnum.KG, "stock": 40},
        ItemEnum.CAULIFLOWER: {"individual": 350.0, "business": 320.0, "unit": UnitEnum.PIECE, "stock": 50},
        ItemEnum.BELL_PEPPER: {"individual": 450.0, "business": 400.0, "unit": UnitEnum.KG, "stock": 60},
        ItemEnum.CHILI: {"individual": 800.0, "business": 720.0, "unit": UnitEnum.KG, "stock": 30},
        ItemEnum.CUCUMBER: {"individual": 180.0, "business": 160.0, "unit": UnitEnum.KG, "stock": 90},
        ItemEnum.EGGPLANT: {"individual": 220.0, "business": 200.0, "unit": UnitEnum.KG, "stock": 70},
        ItemEnum.OKRA: {"individual": 300.0, "business": 270.0, "unit": UnitEnum.KG, "stock": 50},
        ItemEnum.GREEN_BEANS: {"individual": 250.0, "business": 220.0, "unit": UnitEnum.KG, "stock": 80},
        ItemEnum.PUMPKIN: {"individual": 120.0, "business": 100.0, "unit": UnitEnum.KG, "stock": 60},
        ItemEnum.BEETROOT: {"individual": 300.0, "business": 270.0, "unit": UnitEnum.KG, "stock": 50},
        ItemEnum.RADISH: {"individual": 200.0, "business": 180.0, "unit": UnitEnum.KG, "stock": 70},
        ItemEnum.GINGER: {"individual": 600.0, "business": 540.0, "unit": UnitEnum.KG, "stock": 40},
        ItemEnum.GARLIC: {"individual": 800.0, "business": 720.0, "unit": UnitEnum.KG, "stock": 30},
    }

    print(f"Creating ALL {len(product_pricing)} products for main farmer...")

    for item_enum, pricing in product_pricing.items():
        # Create product
        product = FarmerProduct(
            farmer_id=farmer_id,
            item=item_enum,
            description=f"Fresh organic {item_enum.value.replace('_', ' ')}, pesticide-free",
            is_active=True,
            harvest_date=datetime.now() - timedelta(days=1),
            expiry_date=datetime.now() + timedelta(days=10)
        )
        db.add(product)
        db.flush()

        # Individual pricing
        individual_unit_price = ProductUnitPrice(
            farmer_product_id=product.id,
            unit=pricing["unit"],
            customer_type=CustomerTypeEnum.INDIVIDUAL,
            price_per_unit=pricing["individual"],
            quantity_available=pricing["stock"],
            minimum_order=1
        )
        db.add(individual_unit_price)

        # Business pricing (bulk orders)
        business_unit_price = ProductUnitPrice(
            farmer_product_id=product.id,
            unit=pricing["unit"],
            customer_type=CustomerTypeEnum.BUSINESS,
            price_per_unit=pricing["business"],
            quantity_available=pricing["stock"] * 2,
            minimum_order=25 if pricing["unit"] != UnitEnum.PIECE else 10
        )
        db.add(business_unit_price)


def create_farmer_products(db: Session, farmer_id: int, farmer_name: str):
    # Select 10 random items
    all_items = list(ItemEnum)
    selected_items = random.sample(all_items, 10)

    units = [UnitEnum.KG, UnitEnum.PIECE, UnitEnum.BUNCH, UnitEnum.DOZEN, UnitEnum.BASKET]

    print(f"Creating 10 products for {farmer_name}...")

    for item in selected_items:
        # Randomize unit and pricing
        unit = random.choice(units)
        base_price = random.randint(50, 800)

        # Create product
        product = FarmerProduct(
            farmer_id=farmer_id,
            item=item,
            description=f"Premium {item.value.replace('_', ' ')} from our farm",
            is_active=True,
            harvest_date=datetime.now() - timedelta(days=random.randint(0, 3)),
            expiry_date=datetime.now() + timedelta(days=random.randint(7, 14))
        )
        db.add(product)
        db.flush()

        # Individual pricing
        individual_price = ProductUnitPrice(
            farmer_product_id=product.id,
            unit=unit,
            customer_type=CustomerTypeEnum.INDIVIDUAL,
            price_per_unit=base_price,
            quantity_available=random.randint(20, 150),
            minimum_order=random.choice([1, 2, 3, 5])
        )
        db.add(individual_price)

        # Business pricing
        business_price = ProductUnitPrice(
            farmer_product_id=product.id,
            unit=unit,
            customer_type=CustomerTypeEnum.BUSINESS,
            price_per_unit=base_price * 0.85,  # 15% discount for business
            quantity_available=random.randint(50, 300),
            minimum_order=random.choice([10, 15, 20, 25, 30])
        )
        db.add(business_price)


def create_sample_orders_and_notifications(db: Session, individual_id: int, business_id: int, farmer_id: int):
    print("\n📦 Creating sample orders and notifications...")

    # Create an order for individual user
    order1 = UnifiedOrder(
        order_number=f"ORD-{datetime.now().strftime('%Y%m%d')}-001",
        customer_id=individual_id,
        status=OrderStatusEnum.DELIVERED,
        total_amount=1250.50,
        delivery_fee=100.0,
        final_amount=1350.50,
        customer_name="Isfaaq Emambocus",
        customer_phone="58173526",
        customer_email="individual@test.com",
        delivery_address="Royal Road, Port Louis 11328",
        delivery_notes="Call when arriving",
        created_at=datetime.now() - timedelta(days=3),
        delivered_at=datetime.now() - timedelta(days=1)
    )
    db.add(order1)
    db.flush()

    # Create order items
    order_item1 = UnifiedOrderItem(
        order_id=order1.id,
        farmer_id=farmer_id,
        farmer_product_id=1,  # Assuming first product
        item_name="Fresh Apples",
        unit="kg",
        unit_price=450.0,
        quantity=2.0,
        total_price=900.0,
        product_description="Fresh organic apples"
    )
    db.add(order_item1)

    order_item2 = UnifiedOrderItem(
        order_id=order1.id,
        farmer_id=farmer_id,
        farmer_product_id=2,  # Assuming second product
        item_name="Bananas",
        unit="dozen",
        unit_price=180.0,
        quantity=2.0,
        total_price=360.0,
        product_description="Fresh bananas"
    )
    db.add(order_item2)

    # Create payment
    payment1 = UnifiedPayment(
        order_id=order1.id,
        payment_method=PaymentMethodEnum.CASH_ON_DELIVERY,
        status=PaymentStatusEnum.SUCCESSFUL,
        amount=1350.50,
        currency="MUR",
        completed_at=datetime.now() - timedelta(days=1)
    )
    db.add(payment1)

    # Create farmer payment
    farmer_payment1 = FarmerPayment(
        order_id=order1.id,
        farmer_id=farmer_id,
        gross_amount=1250.50,
        platform_fee=125.05,
        net_amount=1125.45,
        platform_fee_percentage=10.0,
        payment_status="paid",
        paid_at=datetime.now() - timedelta(days=1)
    )
    db.add(farmer_payment1)

    # Create farmer status
    farmer_status1 = UnifiedOrderFarmerStatus(
        order_id=order1.id,
        farmer_id=farmer_id,
        status="delivered",
        status_changed_at=datetime.now() - timedelta(days=1)
    )
    db.add(farmer_status1)

    # Create notifications for farmer (order received)
    notification1 = Notification(
        user_id=farmer_id,
        order_id=order1.id,
        type=NotificationTypeEnum.ORDER_CREATED,
        title="New Order Received!",
        message=f"Order {order1.order_number} - 2 items, Rs 1250.50",
        data=json.dumps({
            "order_number": order1.order_number,
            "item_count": 2,
            "amount": 1250.50
        }),
        is_read=True,
        is_sent=True,
        sent_at=datetime.now() - timedelta(days=3),
        created_at=datetime.now() - timedelta(days=3)
    )
    db.add(notification1)

    # Create notification for customer (order delivered)
    notification2 = Notification(
        user_id=individual_id,
        order_id=order1.id,
        farmer_id=farmer_id,
        type=NotificationTypeEnum.ORDER_DELIVERED,
        title="Order Delivered!",
        message="Your order has been successfully delivered",
        data=json.dumps({
            "order_number": order1.order_number,
            "farmer_name": "Kumar Seebaluck"
        }),
        is_read=False,
        is_sent=True,
        sent_at=datetime.now() - timedelta(days=1),
        created_at=datetime.now() - timedelta(days=1)
    )
    db.add(notification2)

    # Create a business order
    order2 = UnifiedOrder(
        order_number=f"ORD-{datetime.now().strftime('%Y%m%d')}-002",
        customer_id=business_id,
        status=OrderStatusEnum.PROCESSING,
        total_amount=5850.00,
        delivery_fee=200.0,
        final_amount=6050.00,
        customer_name="Raj Patel",
        customer_phone="52987654",
        customer_email="business@test.com",
        delivery_address="Sir William Newton Street, Port Louis 11302",
        delivery_notes="Business delivery - loading dock access",
        created_at=datetime.now() - timedelta(days=1)
    )
    db.add(order2)
    db.flush()

    # Create business order items
    order_item3 = UnifiedOrderItem(
        order_id=order2.id,
        farmer_id=farmer_id,
        farmer_product_id=3,
        item_name="Organic Tomatoes",
        unit="kg",
        unit_price="320.0",
        quantity=15.0,
        total_price=4800.0,
        product_description="Fresh organic tomatoes for business"
    )
    db.add(order_item3)

    order_item4 = UnifiedOrderItem(
        order_id=order2.id,
        farmer_id=farmer_id,
        farmer_product_id=4,
        item_name="Fresh Onions",
        unit="kg",
        unit_price="270.0",
        quantity=5.0,
        total_price=1350.0,
        product_description="Fresh onions for business"
    )
    db.add(order_item4)

    # Create business payment
    payment2 = UnifiedPayment(
        order_id=order2.id,
        payment_method=PaymentMethodEnum.BANK_TRANSFER,
        status=PaymentStatusEnum.PENDING,
        amount=6050.00,
        currency="MUR"
    )
    db.add(payment2)

    # Create business farmer payment
    farmer_payment2 = FarmerPayment(
        order_id=order2.id,
        farmer_id=farmer_id,
        gross_amount=6150.00,
        platform_fee=615.00,
        net_amount=5535.00,
        platform_fee_percentage=10.0,
        payment_status="pending"
    )
    db.add(farmer_payment2)

    # Create business farmer status
    farmer_status2 = UnifiedOrderFarmerStatus(
        order_id=order2.id,
        farmer_id=farmer_id,
        status="processing",
        status_changed_at=datetime.now() - timedelta(hours=12)
    )
    db.add(farmer_status2)

    # Create device tokens for testing
    device_token1 = DeviceToken(
        user_id=farmer_id,
        expo_push_token="ExponentPushToken[farmer-test-token-123]",
        device_id="test-device-android-farmer",
        platform="android",
        is_active=True
    )
    db.add(device_token1)

    device_token2 = DeviceToken(
        user_id=individual_id,
        expo_push_token="ExponentPushToken[individual-test-token-456]",
        device_id="test-device-ios-individual",
        platform="ios",
        is_active=True
    )
    db.add(device_token2)

    device_token3 = DeviceToken(
        user_id=business_id,
        expo_push_token="ExponentPushToken[business-test-token-789]",
        device_id="test-device-android-business",
        platform="android",
        is_active=True
    )
    db.add(device_token3)

    print("✅ Created sample orders, payments, and notifications")


def seed_database():
    print("=" * 60)
    print("🏝️ Starting FarmLink Mauritius Testing Database Setup...")
    print("=" * 60)

    # Create database session
    db = SessionLocal()
    try:
        # Reset database
        reset_database(db)

        print("\n👥 Creating main test users...")
        individual_id, business_id, farmer_id = create_test_users(db)

        # Create additional users
        additional_farmer_ids = create_additional_users(db)

        print(f"\n🥕 Creating ALL products for main farmer (ID: {farmer_id})...")
        create_all_products(db, farmer_id)

        print(f"\n🌱 Creating products for additional farmers...")
        farmer_names = ["roshan", "nisha", "ibrahim", "kavitha"]
        for i, add_farmer_id in enumerate(additional_farmer_ids):
            create_farmer_products(db, add_farmer_id, farmer_names[i])

        # Create sample orders and notifications for main users
        create_sample_orders_and_notifications(db, individual_id, business_id, farmer_id)

        db.commit()
        print("\n" + "=" * 60)
        print("✅ Mauritius Testing Database Setup Completed!")
        print("=" * 60)
        print(f"🔑 Password for all users: {DEFAULT_PASSWORD}")
        print("=" * 60)
        print("🧪 Main test accounts:")
        print("  👤 Individual: individual@test.com (Isfaaq Emambocus)")
        print("  🏢 Business: business@test.com (Tropical Delights Ltd)")
        print("  🚜 Farmer: farmer@test.com (Kumar Seebaluck)")
        print("=" * 60)
        print("📋 Additional test accounts:")
        print("  👤 Individual: priya@test.com, faizal@test.com, anita@test.com, yasin@test.com")
        print("  🏢 Business: lisa@test.com, ahmed@test.com, marie@test.com, zara@test.com")
        print("  🚜 Farmer: roshan@test.com, nisha@test.com, ibrahim@test.com, kavitha@test.com")
        print("=" * 60)
        print("🎯 Ready for Testing!")

    except Exception as e:
        print(f"\n❌ Error during seeding: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()