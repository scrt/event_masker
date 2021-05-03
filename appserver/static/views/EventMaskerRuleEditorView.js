require.config({
    paths: {
        jexcel: "../app/event_masker/contrib/jexcel/jexcel",
        jsuites: "../app/event_masker/contrib/jsuites/jsuites",
        text: "../app/event_masker/contrib/text",
    },
    shim: {
        jexcel: {
            deps: ["jquery", "jsuites"],
        }
    }
});

define(['underscore', 
    'splunkjs/mvc', 
    'jquery', 
    'splunkjs/mvc/simplesplunkview', 
    'text!../app/event_masker/templates/EventMaskerRuleEditor.html', 
    "css!../app/event_masker/EventMaskerRuleEditor.css", 
    'jexcel', 
    'jsuites',  
    "css!../app/event_masker/contrib/jexcel/jexcel.css", 
    "css!../app/event_masker/contrib/jsuites/jsuites.css"],

    function (_, mvc, $, SimpleSplunkView, EventMaskerRuleEditorTemplate) {

        // Get current user
        var currentUser=Splunk.util.getConfigValue("USERNAME");

        // Define the custom view class
        var EventMaskerRuleEditorView = SimpleSplunkView.extend({
            className: "EventMaskerRuleEditorView",

            defaults: {
                'collection_owner': 'nobody',
                'list_link': null,
                'list_link_title': "Back to list"
            },

            events: {
                "click #save": "saveRule",
                "click #cancel": "gotoToList"
            },

            initialize: function () {

                // Apply the defaults
                this.options = _.extend({}, this.defaults, this.options);

                this.list_link = this.options.list_link;
                this.list_link_title = this.options.list_link_title;

                this.lister = this.options.lister;

                this.collection_owner = this.options.collection_owner;
                this.app = this.options.app;
                this.collection = this.options.collection;

                this.rule = null;
                this.jexcel = null;
            },

            hasCapability: function (capability) {

                var uri = Splunk.util.make_url("/splunkd/__raw/services/authentication/current-context?output_mode=json");

                if (this.capabilities === null) {

                    // Fire off the request
                    jQuery.ajax({
                        url: uri,
                        type: 'GET',
                        async: false,
                        success: function (result) {

                            if (result !== undefined) {
                                this.capabilities = result.entry[0].content.capabilities;
                            }

                        }.bind(this)
                    });
                }

                return $.inArray(capability, this.capabilities) >= 0;

            },

            getRule: function (key) {
                var uri = Splunk.util.make_url("/splunkd/__raw/servicesNS/" + this.collection_owner + "/" + this.app + "/storage/collections/data/" + this.collection + "/" + key + "?output_mode=json");
                var conditions = null;

                jQuery.ajax({
                    url: uri,
                    type: 'GET',
                    async: false,
                    success: function (results) {

                        // Use the include filter function to prune items that should not be included (if necessary)
                        if (key === "" && this.include_filter !== null) {
                            conditions = [];

                            // Store the unfiltered list of lookups
                            this.unfiltered_conditions = results;

                            for (var c = 0; c < results.length; c++) {
                                if (this.include_filter(results[c])) {
                                    conditions.push(results[c]);
                                }
                            }
                        }

                        // Just pass the lookups if no filter is necessary.
                        else {
                            conditions = results;
                        }
                    }.bind(this)
                });

                return conditions;
            },

            render: function () {

                // Load the rule
                var key = this.getParameterByName("key");
                rule = this.getRule(key);
                this.rule = rule;

                insufficient_permissions = false;


                // Render the view
                this.$el.html(_.template(EventMaskerRuleEditorTemplate, {
                    lister: this.lister,
                    insufficient_permissions: insufficient_permissions,
                    title: rule.title,
                    match_type: rule.match_type,
                    list_link: this.list_link,
                    list_link_title: this.list_link_title,
                    is_new: false 
                }));

                // Start the process of loading the lookup file into the interface
                this.loadRule(rule);

            },

            loadRule: function (rule) {
                this.setupTable(rule.conditions);
                $("#tableEditor").show();
                $(".table-loading-message").hide();
            },

            doSaveRule: function () {

                var today = new Date();
                var month = today.getMonth()+1
                if (month < 10){
                    month = "0" + month
                }
                var day = today.getDate()
                if (day < 10){
                    day = "0" + day
                }
                var minutes = today.getMinutes()
                if (minutes < 10){
                    minutes = "0" + minutes
                }
                var date = today.getFullYear()+'-'+ month +'-'+ day;
                var time = today.getHours() + ":" + minutes;
                var dateTime = date+'T'+time;

                var row_data = this.jexcel.getData();

                // Check validations
                if (this.validate(row_data) !== 0) {
                    return false;
                }

                var conditions = Array();
                _.each(row_data, function (rule) {
                    conditions.push({field: rule[0], operator: rule[1], value: rule[2], iscasesensitive: rule[3]});
                });

                var new_rule = this.rule;
                new_rule.conditions = conditions;
                new_rule.modificationDate = dateTime;
                new_rule.modificationUser = currentUser;
                var uri = Splunk.util.make_url("/splunkd/__raw/servicesNS/" + this.collection_owner + "/" + this.app + "/storage/collections/data/" + this.collection + "/" + new_rule._key + "?output_mode=json");

                $.ajax({
                    url: uri,
                    type: 'POST',
                    async: false,
                    contentType: "application/json",
                    data: JSON.stringify(new_rule),
                    error: function (jqXHR, textStatus, errorThrown) {
                        alert("The rule could not be saved");
                        $("#save").text("Save");
                    },
                    success: this.saveSuccess.bind(this),
                });

                return false;
            },

            saveRule: function () {
                $("#save > span").text("Saving...");
                // Use a delay so that the event loop is able to change the button text before the work begins
                setTimeout(this.doSaveRule.bind(this), 100);
            },


            /**
             * Get the parameter with the given name.
             */
            getParameterByName: function (name) {
                name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");

                var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
                    conditions = regex.exec(location.search);

                return conditions === null ? null : decodeURIComponent(conditions[1].replace(/\+/g, " "));
            },

            /**
             * Setup the table with the data.
             */
            setupTable: function (data) {

                var slice = ($(document).width() / 8) - 15;
                var slices = [slice, slice, slice*5, slice];

                var options = {
                    minDimensions:[1,1],
                    data: data,
                    startRows: 1,
                    startCols: 1,
                    minSpareRows: 0,
                    minSpareCols: 0,
                    rowResize: 1,
                    colHeaders: ["field", "operator", "value", "iscasesensitive"],
                    colWidths: slices,
                    columns: [{data: "field", type: "text", align: "left"},
                        {
                            data: "operator",
                            type: "dropdown",
                            source: ["<", ">", "is", "is not", "<=", ">=", "contains", "does not contain", "starts with", "ends with", "matches", "does not match"],
                            autocomplete: "true"
                        },
                        {data: "value", type: "text", align: "left"},
                        {
                            data: "iscasesensitive",
                            type: "checkbox",
                        },
                    ],
                    rowHeaders: false,
                    stretchH: 'all',
                    manualColumnResize: true,
                    manualColumnMove: false,
                    fixedRowsTop: 0,
                    height: $(document).height() - 320,
                    allowInsertColumn: false,
                    allowManualInsertColumn: false,
                    allowDeleteColumn: false,
                    allowRenameColumn: false
                }

                this.jexcel = $("#dataTable").jexcel(options);
            },

            /**
             * Validate the table data.
             */
            validate: function (data) {

                let statusFlag = 0;
                let errorMsg = "";

                // Check minimum one row
                if (data.length < 1) {
                    statusFlag = 1;
                    errorMsg = "You need to have at least one row";
                }

                // Make sure you have at least two rows if this an All(AND) match type rule
                if (rule.match_type === "all" && (data.length < 2)) {
                    statusFlag = 2;
                    errorMsg = "You need to define at least two rules";
                }
                 
                // Check for empty cells + field format
                var badChars = /[\\|\/|\||;|:|&|@]/g;
                for (i = 0; i < data.length; ++i) {
                    for (j = 0; j < data[i].length; ++j) {
                        if (!data[i][j] && (i != 3 && j == 0 )) {
                            statusFlag = 3;
                            errorMsg = "All cells need to be fulfilled";
                        } else if (j === 0 && data[i][j].match(badChars)) {
                            statusFlag = 4;
                            errorMsg = "Bad char found in a \"field\" column cell";
                        }
                    }
                }

                // Check max size
                let maxSize = 10000;
                if (data.length >= maxSize) {
                    statusFlag = 5;
                    errorMsg = "The size of the spreadsheet exceeds 10'000 lines";
                }

                // Display error
                if (statusFlag !== 0) {
                    $("#item-data-table > div > .widgeterror").text(errorMsg);
                    $("#item-data-table > div > .widgeterror").show();
                    $("#save > span").text("Save");
                    alert(errorMsg);
                }

                return statusFlag;
            },

            /**
             * Go to the lookups list.
             */
            gotoToList: function () {

                if ($('#returnto').length > 0 && $('#returnto').val()) {
                    document.location = $('#returnto').val();
                } else if (this.lister !== null && this.lister !== undefined) {
                    document.location = this.lister;
                }
            },

            /**
             * Save succeeded.
             */
            saveSuccess: function () {

                $("#save").text("Save");

                // Return the user to the rule list
                this.gotoToList();
            },

            /**
             * Set the table dimensions such that it fills the page.
             */
            setTableDimensions: function () {
                // Set the data-table width and height so that the editor takes up the entire page
                // We shouldn't have to do this since we should be able to use width of 100%. However, width 100% only works if
                // the parents have widths defined all the way to the top (which they don't).
                $('#dataTable').width($(document).width() - 100);
                $('#dataTable').height($(document).height() - 600);
                $('#dataTable').css("overflow","auto");
            }

        });


        return EventMaskerRuleEditorView;
    });
