'use strict';

var grunt = require('grunt');
var sinon = require('sinon');
var path = require('path');

var child_process = require('child_process');

function runGruntTask(taskName, callback) {
    var task = grunt.task._taskPlusArgs(taskName);
    task.task.fn.apply({
        nameArgs: task.nameArgs,
        name: task.task.name,
        args: task.args,
        flags: task.flags,
        async: function() { return callback; }
    }, task.args);
}

function stubChildProcess() {
    return {
        stdin: {
            end: sinon.stub()
        },
        on: sinon.stub()
    };
}

var child_process_fork = child_process.fork;

exports.coveralls = {
    setUp: function (callback) {
        child_process.fork = sinon.stub();
        callback();
    },

    tearDown: function (callback) {
        child_process.fork = child_process_fork;
        callback();
    },

    submits_file_to_coveralls: function (test) {
        var procStub = stubChildProcess();
        var inputStub = procStub.stdin.end;
        child_process.fork.returns(procStub);

        runGruntTask('coveralls:basic_test', function (result) {
            test.ok(result, 'Should be successful');

            test.ok(child_process.fork.calledWith(path.resolve('./node_modules/coveralls/bin/coveralls.js')));
            test.ok(inputStub.calledOnce);
            test.ok(inputStub.calledWith('lcov.info content'), 'Should send lcov data');
            test.done();
        });

        procStub.on.withArgs('exit').yield(0);
    },

    submits_nothing_if_the_file_is_missing: function (test) {
        runGruntTask('coveralls:missing_file_test', function (result) {
            test.ok(!result, 'Should fail');

            test.ok(!child_process.fork.called);
            test.done();
        });
    },

    submits_multiple_files: function (test) {
        var procStub = stubChildProcess();
        var inputStub = procStub.stdin.end;
        child_process.fork.returns(procStub);

        runGruntTask('coveralls:multiple_files_test', function (result) {
            test.ok(result, 'Should be successful');

            test.ok(inputStub.calledTwice);
            test.ok(inputStub.calledWith('lcov.info content'), 'Should send first file data');
            test.ok(inputStub.calledWith('lcov2.info content'), 'Should send second file data');
            test.done();
        });

        procStub.on.withArgs('exit').yield(0);
    },

    submits_present_files_only_if_some_are_missing: function (test) {
        var procStub = stubChildProcess();
        var inputStub = procStub.stdin.end;
        child_process.fork.returns(procStub);

        runGruntTask('coveralls:some_missing_files_test', function (result) {
            test.ok(result, 'Should be successful');

            test.ok(inputStub.calledOnce);
            test.ok(inputStub.calledWith('lcov.info content'), 'Should send first file data');
            test.done();
        });

        procStub.on.withArgs('exit').yield(0);
    },

    fails_if_multiple_files_listed_and_all_files_are_missing: function (test) {
        runGruntTask('coveralls:all_missing_files_test', function (result) {
            test.ok(!result, 'Should fail');

            test.ok(!child_process.fork.called);
            test.done();
        });
    },

    fails_if_any_files_fail_to_upload: function (test) {
        var procStub = stubChildProcess();
        child_process.fork.returns(procStub);

        runGruntTask('coveralls:basic_test', function (result) {
            test.ok(!result, 'Should fail');
            test.done();
        });

        // Process returns non-0 status code
        procStub.on.withArgs('exit').yield(1);
    }
};
