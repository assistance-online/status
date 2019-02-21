$(document).ready(function () {        
    var config = {};
    var labels = [];
    var openIssues = [];
    var closedIssues = [];
    var items = [];
    var markDownConverter = new showdown.Converter();
    var systemStatus = StatusEnum.Unknown;

    function getRequestGithub(url) {
        return $.ajax({
            url: url,
            type: 'GET',
            dataType: 'json',
            beforeSend: function (xhr) {
                xhr.setRequestHeader('Authorization', `token ${config.github.token}`)
            }
        });
    }

    function processSystemStatus() {
        var itemMilestones = [];
        items.map(item => {            
            itemMilestones = itemMilestones.concat(item.milestones);
        });
        systemStatus = getStatusBasedOnIssueMilestones(itemMilestones);


        var text = '';
        
        switch (systemStatus) {
            case StatusEnum.Maintenance:
                text = 'Systeem is in onderhoud';
                break;
            case StatusEnum.XL:
                text = 'Ernstige verstoring geconstateerd';
                break;
            case StatusEnum.L:
            case StatusEnum.M:
            case StatusEnum.S:
                text = 'Storing geconstateerd';
                break;
            case StatusEnum.UnderInvestigation:
                text = 'Er zijn meldingen geweest over verstoringen, deze worden momenteel onderzocht.';
                break;
            default:
                text = 'Momenteel zijn er geen actuele verstoringen bekend.'
                break;
        }
        
        var html = `
            <div class="row no-gutters">
                <div class="col-sm-1 ${getBackgroundColorClass(systemStatus)} ">
                    <div class="card-body text-center align-middle text-white">
                        <i class="fas ${getStatusIcon(systemStatus)} fa-lg"></i>
                    </div>
                </div>
                <div class="col-sm-11">
                    <div class="card-body align-middle">
                        <h5 class="card-title mb-0">${text}</h5>
                    </div>
                </div>
            </div>`;
        
        $('#system-status').html(html);        
    }

    function processStatusItems() {
        var itemsHtml = '';
        
        items.forEach(item => {
            var status = getStatusBasedOnIssueMilestones(item.milestones);

            var iconClass = getStatusIcon(status);
            var textColorClass = getTextColorClass(status);
            textColorClass = textColorClass === 'text-white' ? 'text-dark' : textColorClass;
            var label = getStatusDescription(status);

            var itemHtml = `        
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    <span>
                    <i class="fas ${iconClass} ${textColorClass} mr-2"></i>
                        ${item.name}
                    </span>
                    <span class="badge badge-pill ${textColorClass}">${label}</span>
                </li>`;
            itemsHtml += itemHtml;
        });
        $('#status-items').html(itemsHtml);
    }

    function processIssues(useOpenIssues) {
        var itemsHtml = '';
        var issues = useOpenIssues ? openIssues : closedIssues;

        issues.forEach(issue => {
            var labelsHtml = '';
            var status = getStatusBasedOnIssueMilestone(issue.milestone);
            var backgroundColor = getBackgroundColorClass(status);
            labelsHtml += `
                <span class="badge ${backgroundColor} text-white">${issue.milestone.title}</span>
            `;

            issue.labels.forEach(label => {
                labelsHtml += `
                    <span class="badge bg-dark text-white">${label.name}</span>
                `;
            });

            var itemHtml = `
                <dt>
                    <a target="_blank" href="${issue.html_url}"><h2>${issue.title}</h2></a>                    
                </dt>
                <dd>                
                    <small>${moment(issue.created_at).format('D MMMM YYYY HH:mm')}</small> 
                    ${labelsHtml}
                    <br>${markDownConverter.makeHtml(issue.body)}
                </dd>`;

            itemsHtml += itemHtml;
        });

        if (useOpenIssues) {
            $('#open-issues').html(itemsHtml);
        } else {
            $('#closed-issues').html(itemsHtml);
        }
    }

    function getStatusIcon(status) {
        switch (status) {
            case StatusEnum.Online:
                return 'fa-check';
            case StatusEnum.XL:                
            case StatusEnum.L:
            case StatusEnum.M:                
            case StatusEnum.S:
                return 'fa-exclamation-triangle';            
            case StatusEnum.UnderInvestigation:
                return 'fa-search';
            case StatusEnum.Maintenance:
                return 'fa-tools';
            default:
                return 'fa-question';
        }
    }    

    function getBackgroundColorClass(status) {
        switch (status) {
            case StatusEnum.Online:
                return 'bg-success';
            case StatusEnum.XL:
                return 'bg-danger';            
            case StatusEnum.L:
            case StatusEnum.M:
                return 'bg-warning';            
            case StatusEnum.S:
                return 'bg-info';
            default:
                return 'bg-dark';            
        }
    }

    function getTextColorClass(status) {
        switch (status) {
            case StatusEnum.Online:
                return 'text-success';
            case StatusEnum.XL:
                return 'text-danger';            
            case StatusEnum.L:
            case StatusEnum.M:
                return 'text-warning';            
            case StatusEnum.S:
                return 'text-info';
            case StatusEnum.UnderInvestigation:
                return 'text-white';
            case StatusEnum.Maintenance:
                return 'text-dark';
            default:
                return '';
        }
    }

    function getStatusDescription(status) {
        switch (status) {
            case StatusEnum.Online:
                return 'Online';
            case StatusEnum.XL:
                return 'XL';            
            case StatusEnum.L:
                return 'L';
            case StatusEnum.M:
                return 'M';            
            case StatusEnum.S:
                return 'S';
            case StatusEnum.UnderInvestigation:
                return 'Wordt onderzocht';
            case StatusEnum.Maintenance:
                return 'Onderhoud';
            default:
                return 'Onbekend';
        }
    }

    function getStatusBasedOnIssueMilestones(milestones) {
        if (milestones.length === 0) {
            return StatusEnum.Online;
        }
        
        var milestonesEnum = milestones.map(milestone => getStatusBasedOnIssueMilestone(milestone));     

        if (milestonesEnum.indexOf(StatusEnum.Maintenance) !== -1) {
            return StatusEnum.Maintenance;
        } else if (milestonesEnum.indexOf(StatusEnum.XL) !== -1) {
            return StatusEnum.XL;
        } else if (milestonesEnum.indexOf(StatusEnum.L) !== -1) {
            return StatusEnum.L;
        } else if (milestonesEnum.indexOf(StatusEnum.M) !== -1) {
            return StatusEnum.M;
        } else if (milestonesEnum.indexOf(StatusEnum.S) !== -1) {
            return StatusEnum.S;        
        } else if (milestonesEnum.indexOf(StatusEnum.UnderInvestigation) !== -1) {
            return StatusEnum.UnderInvestigation;
        } else {
            return StatusEnum.Unknown;
        } 
    }

    function getStatusBasedOnIssueMilestone(milestone) {
        switch (milestone.title.toLowerCase()) {
            case 'xl':
                return StatusEnum.XL;
            case 'l':
                return StatusEnum.L;
            case 'm':
                return StatusEnum.M;
            case 's':
                return StatusEnum.S;
            case 'maintenance':
                return StatusEnum.Maintenance;
            case 'under investigation':
                return StatusEnum.UnderInvestigation;
            default:
                return StatusEnum.Unknown;
        }
    }

    function getLabelsFromGithub() {
        getRequestGithub(`https://api.github.com/repos/${config.github.repository}/status/labels`)
            .then(result => {
                labels = result.map(x => x.name);
                labels.forEach(label => {
                    items.push({
                        name: label,
                        milestones: []
                    });
                });


                getOpenIssuesFromGithub();                
            });
    }

    function getOpenIssuesFromGithub() {
        getRequestGithub(`https://api.github.com/repos/${config.github.repository}/status/issues?state=open`)
            .then(result => {
                openIssues = result;

                openIssues.forEach(issue => {  
                    if (issue.milestone && issue.labels) {
                        issue.labels.forEach(label => { 
                            var item = items.find(x => x.name === label.name)
                            if (item && item.milestones.findIndex(milestone => milestone.title === issue.milestone.title) === -1) {
                                item.milestones.push(issue.milestone);
                            }
                        });
                    }
                });

                processIssues(true);
                processStatusItems();
                processSystemStatus();

                $('#open-issues-count').text(openIssues.length);
            });        
    }  

    function getClosedIssuesFromGithub() {
        getRequestGithub(`https://api.github.com/repos/${config.github.repository}/status/issues?state=closed`)
            .then(result => {
                closedIssues = result;

                processIssues(false);
            });        
    }            

    // Get configuration values
    $.getJSON('../config.json', (data) => {
        config = data; 

        // Actually get the data
        getLabelsFromGithub();
        getClosedIssuesFromGithub();
    });    
});


const StatusEnum = {
    Unknown: 'Unknown',
    Online: 'Online',
    XL: 'Blocking',
    L: 'HighPriority',
    M: 'RegularPriority',
    S: 'MinorIssue',
    UnderInvestigation: 'UnderInvestigation',
    Maintenance: 'Maintenance'
}
