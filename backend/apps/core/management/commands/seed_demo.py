"""Seed fictional development/demo accounts and tenancy data.

This command is for development/demo use only. It creates fictional
``@demo.local`` accounts for local demos and tests, and does not create real
patient, NHS, customer, or stock data.
"""

from typing import NamedTuple

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import User
from apps.tenancy.models import Group, Membership, Pharmacy, Role

DEMO_PASSWORD = "DemoPass!2026"

GROUP_SLUG = "jmw-pharmacy-group"
GROUP_NAME = "JMW Pharmacy Group"

PHARMACIES = [
    {"name": "JMW Sutton", "code": "SUT"},
    {"name": "JMW Croydon", "code": "CRO"},
    {"name": "JMW Wimbledon", "code": "WIM"},
]


class DemoUser(NamedTuple):
    email: str
    full_name: str
    role: str
    pharmacy_code: str | None


DEMO_USERS = [
    DemoUser("admin@demo.local", "Demo Admin", "ADMIN", None),
    DemoUser(
        "superintendent@demo.local",
        "Demo Superintendent",
        "SUPERINTENDENT",
        None,
    ),
    DemoUser("pharmacist@demo.local", "Demo Pharmacist", "PHARMACIST", "SUT"),
    DemoUser("dispenser@demo.local", "Demo Dispenser", "DISPENSER", "CRO"),
    DemoUser("stock@demo.local", "Demo Stock Employee", "STOCK_EMPLOYEE", None),
]


class Command(BaseCommand):
    help = "Seed fictional local/demo users and tenancy data."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--force",
            action="store_true",
            help="Allow seed_demo to run when DEBUG is false.",
        )

    def handle(self, *args, **options) -> None:
        if not settings.DEBUG and not options["force"]:
            raise CommandError("seed_demo is dev-only; pass --force to override.")

        with transaction.atomic():
            group, group_created = Group.objects.get_or_create(
                slug=GROUP_SLUG,
                defaults={
                    "name": GROUP_NAME,
                    "is_active": True,
                },
            )
            group.name = GROUP_NAME
            group.is_active = True
            group.save(update_fields=["name", "is_active", "updated_at"])

            pharmacies_by_code = {}
            pharmacy_statuses = []
            for pharmacy_data in PHARMACIES:
                pharmacy, created = Pharmacy.objects.get_or_create(
                    group=group,
                    code=pharmacy_data["code"],
                    defaults={
                        "name": pharmacy_data["name"],
                        "is_active": True,
                    },
                )
                pharmacy.name = pharmacy_data["name"]
                pharmacy.is_active = True
                pharmacy.save(update_fields=["name", "is_active", "updated_at"])
                pharmacies_by_code[pharmacy.code] = pharmacy
                pharmacy_statuses.append((pharmacy, created))

            user_statuses = []
            for user_data in DEMO_USERS:
                user, created = self._get_or_create_user(
                    email=user_data.email,
                    full_name=user_data.full_name,
                )
                user.full_name = user_data.full_name
                user.is_active = True
                user.must_change_password = False
                user.is_staff = False
                user.is_superuser = False
                user.set_password(DEMO_PASSWORD)
                user.save()

                membership = self._get_or_create_active_membership(user)
                self._configure_membership(
                    membership=membership,
                    role=user_data.role,
                    group=group,
                    pharmacy=pharmacies_by_code.get(user_data.pharmacy_code),
                    pharmacies_by_code=pharmacies_by_code,
                )
                user_statuses.append((user, created))

        self.stdout.write(self.style.SUCCESS("Seeded local demo data."))
        self.stdout.write(
            f"Group: {group.name} ({'created' if group_created else 'found'})"
        )
        self.stdout.write("Pharmacies:")
        for pharmacy, created in pharmacy_statuses:
            self.stdout.write(
                f"- {pharmacy.name} [{pharmacy.code}] "
                f"({'created' if created else 'found'})"
            )
        self.stdout.write("Demo users:")
        for user, created in user_statuses:
            self.stdout.write(f"- {user.email} ({'created' if created else 'found'})")
        self.stdout.write(
            f"Shared password ({self.style.WARNING('local demo credentials only')}): "
            f"{DEMO_PASSWORD}"
        )

    def _get_or_create_user(self, *, email: str, full_name: str):
        try:
            return User.objects.get(email=email), False
        except User.DoesNotExist:
            return (
                User.objects.create_user(
                    email=email,
                    password=DEMO_PASSWORD,
                    full_name=full_name,
                    must_change_password=False,
                ),
                True,
            )

    def _get_or_create_active_membership(self, user: User) -> Membership:
        membership = Membership.objects.filter(user=user, is_active=True).first()
        if membership is not None:
            return membership
        return Membership.objects.create(user=user, role=Role.ADMIN)

    def _configure_membership(
        self,
        *,
        membership: Membership,
        role: str,
        group: Group,
        pharmacy: Pharmacy | None,
        pharmacies_by_code: dict[str, Pharmacy],
    ) -> None:
        membership.role = role
        membership.group = None
        membership.pharmacy = None

        if role in {Role.SUPERINTENDENT, Role.STOCK_EMPLOYEE}:
            membership.group = group
        elif role in {Role.PHARMACIST, Role.DISPENSER}:
            membership.pharmacy = pharmacy

        membership.is_active = True
        membership.save()

        if role == Role.STOCK_EMPLOYEE:
            membership.pharmacies.set(
                [
                    pharmacies_by_code["SUT"],
                    pharmacies_by_code["CRO"],
                ]
            )
        else:
            membership.pharmacies.clear()
