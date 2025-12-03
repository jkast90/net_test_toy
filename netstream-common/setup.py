from setuptools import setup, find_packages

setup(
    name="netstream-common",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "pydantic>=2.0.0",
    ],
)
