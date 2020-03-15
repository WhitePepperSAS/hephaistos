from unittest.mock import patch
from unittest import TestCase
from inspect import getmembers

import sys
import imp
from contextlib import contextmanager
from io import StringIO
import pytest

@contextmanager
def captured_output():
    new_out = StringIO()
    old_out = sys.stdout
    try:
        sys.stdout = new_out
        yield sys.stdout
    finally:
        sys.stdout = old_out

def load_module():
    if 'moduletotest' in sys.modules:
        imp.reload(sys.modules['moduletotest'])
    else:
        import moduletotest

def check_value(var, value):
    members = getmembers(sys.modules['moduletotest'])
    elem = [item for item in members if item[0] == var]
    assert len(elem) == 1, "'%s' n'existe pas" % (var)
    assert elem[0][1] == value, "'%s' n'a pas la valeur '%s'" % (var, value)

def get_userdefined_variables():
    return [item for item in dir(sys.modules['moduletotest']) if not item.startswith("__")]

def get_cleaned_output(out, lines, check = False):
    output = out.getvalue().strip()
    l = output.split('\n')
    if check == True:
        assert len(l[-lines:]) == lines, "Pas assez de lignes affichées !"
    return l[-lines:]

class Test(TestCase):
    in_0 = ['1']

    @pytest.mark.timeout(1)
    @patch('builtins.input', side_effect=in_0)
    def test_1(self, input):
        with captured_output() as out:
            load_module()
        output = get_cleaned_output(out, 1, True)
        assert output == ['1']

    in_1 = ['2']

    @pytest.mark.timeout(1)
    @patch('builtins.input', side_effect=in_1)
    def test_2(self, input):
        with captured_output() as out:
            load_module()
        output = get_cleaned_output(out, 2, True)
        assert output == ['1', '2']

    in_2 = ['3']

    @pytest.mark.timeout(1)
    @patch('builtins.input', side_effect=in_2)
    def test_3(self, input):
        with captured_output() as out:
            load_module()
        output = get_cleaned_output(out, 3, True)
        assert output == ['1', '2', '3']

    in_3 = ['4']

    @pytest.mark.timeout(1)
    @patch('builtins.input', side_effect=in_3)
    def test_4(self, input):
        with captured_output() as out:
            load_module()
        output = get_cleaned_output(out, 3, True)
        assert output == ['1', '2', '3']

    in_4 = ['10']

    @pytest.mark.timeout(1)
    @patch('builtins.input', side_effect=in_4)
    def test_10(self, input):
        with captured_output() as out:
            load_module()
        output = get_cleaned_output(out, 5, True)
        assert output == ['1', '2', '3', '5', '7']

    in_5 = ['200']

    @pytest.mark.timeout(1)
    @patch('builtins.input', side_effect=in_5)
    def test_200(self, input):
        with captured_output() as out:
            load_module()
        output = get_cleaned_output(out, 46, True)
        assert output == ["2", "3", "5", "7", "11", "13", "17", "19", "23", "29", "31", "37", "41",
                "43", "47", "53", "59", "61", "67", "71", "73", "79", "83", "89", "97", "101", "103",
                "107", "109", "113", "127", "131", "137", "139", "149", "151", "157", "163", "167",
                "173", "179", "181", "191", "193", "197", "199"]

