"""Tests for the recommendation scoring service."""
import pytest
from app.services.recommendations import _parse_json_array


def test_parse_json_array_valid():
    assert _parse_json_array('["Python", "React"]') == ["Python", "React"]

def test_parse_json_array_none():
    assert _parse_json_array(None) == []

def test_parse_json_array_empty():
    assert _parse_json_array("") == []

def test_parse_json_array_invalid():
    assert _parse_json_array("not json") == []

def test_parse_json_array_not_list():
    assert _parse_json_array('"just a string"') == []
