[![Slack](https://slack.stressgrid.com/badge.svg)](https://slack.stressgrid.com)

# Overview

Stressgrid is a software for load testing at the scale of millions of simulated users.

Stressgrid supports following protocols.

- HTTP 1.0, 1.1 and 2 (over TLS and plain)
- WebSocket
- TCP
- UDP

Stressgrid consists of two components: the **generator** and the **coordinator**.

The generator is a horizontally-scalable component that opens connections to a target server farm, generates the workload, and collects metrics.

The coordinator is a central component that orchestrates multiple generators to execute a **plan**. The plan specifies how many connections to maintain and for how long, and how to ramp up and wind down the workload.

The plan also specifies scripts and their input parameters. Each connection is associated with an instance of a **script** and the corresponding input parameters.

A script executes a sequence of interactions and delays that simulate a workload. It may contain an infinite loop to simulate a long-living connection (that gets terminated during the wind down phase). Or, if a script exits normally, the corresponding connection closes and a new connection opens to maintain the current total number of connections.

Stressgrid scripts are written in Elixir and may only use a predefined set of side-effect functions (like `post` and `delay`) to interact with the generator.

The coordinator is also responsible for the aggregation of **metrics** and **reporting** through pluggable **writers** that can record metrics to a file or database for analysis and visualization.

Currently, two writers are available: the CSV file writer and the Amazon CloudWatch writer. Metrics are reported every minute. Each metric can be represented by a scalar value or by a histogram. Scalar values are used for simple counters accumulated since the beginning of the run, or during the reporting interval. Histogram metrics are used for aggregating statistics across many events that occurred during the reporting interval.

Since a very large number of events—such as HTTP requests—may happen across all connections, Stressgrid uses [HDR histograms](http://hdrhistogram.org) to compress statistics. HRD histograms are compressed within each generator as events take place. Then, generators push the histograms every second to the coordinator, to further compress into the final histogram that is reported every minute to the writers.

Each generator is responsible for the metrics of its own utilization, with two key metrics being collected. First is the number of connections that are currently running a script (active connections). Second is a floating point number between 0 and 1 that represents current CPU utilization. It is very important to keep generator utilization at a healthy level (<0.8) to avoid generators becoming a bottleneck and negating the validity of a stress test.

# Running with Terraform

If you are using AWS or GCP, the easiest way to start using Stressgrid is by deploying it with [Terraform](https://www.terraform.io/). The prerequisites are Terraform 0.12 or higher and [curl](https://curl.haxx.se/). By default, for the coordinator and the generator, the Terraform script will use the public images prepared by the Stressgrid team based on the latest release.

## Running in AWS

    $ cd terraform/aws
    $ terraform init

The [apply](https://www.terraform.io/docs/commands/apply.html) command will create all necessary resources in AWS. You may need to prefix it with AWS credentials that have admin permissions:

    $ AWS_ACCESS_KEY_ID=<...> AWS_SECRET_ACCESS_KEY=<...> terraform apply

The apply command will ask you for the following required Terraform variable:

- `region`: AWS region where Stressgrid will be created, for example *us-east-1*.

## Running in GCP

    $ cd terraform/aws
    $ terraform init

The [apply](https://www.terraform.io/docs/commands/apply.html) command will create all necessary resources in GCP. You may need to prefix it with the path to JSON file with credentials that have owner permissions:

    $ GOOGLE_APPLICATION_CREDENTIALS=<...> terraform apply

The apply command will ask you for the following required Terraform variables:

- `project`: name of the GCP project where Stressgrid will be created;
- `region`: GCP region, for example *us-central1*;
- `zone`: GCP zone, for example *us-central1-a*.

## Optional Terraform variables

In addition, you can specify the following optional variables:

- `capacity`: the desired number of generators, default is *1*;
- `generator_instance_type`: the generator instance type, defaults to *c5.xlarge* in EC2 and *n1-standard-4* in GCP;
- `coordinator_instance_type`: the coordinator instance type, defaults to *t2.micro* in EC2 and *n1-standard-1* in GCP;
- `ami_owner`: owner's AWS account ID to use when looking for AMIs, defaults to *198789150561* (offical Stressgrid account);
- `key_name`: name of the EC2 SSH key pair to use with coordinator and generator instances, defaults to no SSH access;
- `vpc_id`: the ID for the target VPC where Stressgrid will be created, defaults to default VPC;
- `image_project`: GCP project to use when looking for images, defaults to *stressgrid* (offical Stressgrid project);
- `network`: GCP network to use for Stressgrid, defaults to *default*.

The apply command will output the URL of the Stressgrid management website as `coordinator_url`. Note that by default, this website is available only to your public IP address. You may want to change this by adjusting the `stressgrid-coordinator` security group in EC2 or `coordinator-management` firewall in GCP.

# Running tests

## Using management website

![Stressgrid management website](https://gitlab.com/stressgrid/stressgrid/raw/master/doc/management.gif)

The Stressgrid management dashboard is the place to define and run your test plans. The dashboard has the following settings:

- **Plan name** describes the combination of plan settings and target system. For example, let's say we are testing a photo gallery: _10k-browsing-photos-c5-2xlarge_ would be a good name a the simulation of 10k users browsing photos against a c5.2xlarge instance.
- **Desired number of devices** gets rounded down to the **Effective number of devices** by multiples of ramp step size. Rampup and rampdown happen in discrete steps, and each generator has a fixed number of devices that are started and stopped in each step: 10. Therefore, ramp step size is 10 times the number of generators. For example, if we use 100 generators, then the ramp step size will be 1000. We can run tests with the effective number of devices as multiples of 1000.
- **Script** defines siumation behavior. It is written in the [Elixir](https://elixir-lang.org/) programming language. In addition to standard language modules like `Enum`, there are special functions to execute HTTP requests, send and receive TCP data streams and UDP datagrams, and delay execution for a specified period of time.
- **Protocol** defines the protocol to be used for testing.
- **Target host(s)** are one or more IP addresses or hostnames where to send the stress load. If there are multiple hosts, the load is balanced amongst them in round-robin fashion. The same **Target port** is used for all target hosts.
- The **Rampup**, **Sustain**, and **Rampdown** values define the timing parameters of the workload, in seconds. Rampup and rampdown intervals are divided into a number of discrete steps, each one adding or removing device connections. The sustain interval is when the target number of device connections is maintained.

## Using `sgcli`

Alternatively you can use `sgcli` command line interface.

`sgcli run` command will start the run according to the plan specified in arguments. See `sgcli --help` and `sgcli run --help` for details.

`sgcli` will continuously print the telemetry until the run is complete or aborted by pressing ^C. Finally it will output the URL to the results archive. You can use `wget $(sgcli ...)` to have it downloaded.

`sgcli` will return -1 if errors occured during the run and 0 otherwise.  

# Building releases

If you are not running in AWS or are unwilling to use Stressgrid's AMIs, you can build the coordinator and the generator releases yourself. To build Stressgrid releases you’ll need the following:

- Elixir 1.9
- GNU C compiler (for HDR histograms)
- Node.js 8.16.0 (for the management dashboard and the CLI)

## Building the coordinator

To build the coordinator:

    $ cd coordinator/management/
    $ npm install && npm run build-css && npm run build
    $ cd ..
    $ MIX_ENV=prod mix deps.get
    $ MIX_ENV=prod mix release

## Building the generator

To build the generator:

    $ cd generator/
    $ MIX_ENV=prod mix deps.get
    $ MIX_ENV=prod mix release

## Building the command line interface

To build the `sgcli` command line interface:

    $ cd client/
    $ npm install && npm run build

## Installing the command line interface from local build

To install the `sgcli` command:

    $ sudo npm link

# Running the coordinator from local build

To start the coordinator, run:

    $ _build/prod/rel/coordinator/bin/coordinator start

When started, it opens port 8000 for the management website, and port 9696 for generators to connect. If you are running in AWS and are not using our Terraform script, make sure that security groups are set up to the following:

- your browser is enabled to connect to port 8000 of the coordinator;
- generators are enabled to connect to port 9696 of the coordinator;
- generators are enabled to connect to your target instances.

## Amazon CloudWatch metrics

When running in EC2 metrics can be reported to Amazon CloudWatch. To enable this your EC2 instance should have an IAM role associated with it. The only required permission is `cloudwatch:PutMetricData`. If you are using our Terraform script, it will set the coordinator EC2 role with that permission.

# Running the generator(s) from local build

For realistic workloads, you will need multiple generators, each running on a dedicated computer or cloud instance. To start the generator, run:

    $ _build/prod/rel/generator/bin/generator start

You may use `COORDINATOR_URL` environment variable to specify the coordinator WebSocket URL (defaults to `ws://localhost:9696`). Also you may use `GENERATOR_ID` to override default based on hostname. Note that you may need to adjust Linux kernel settings for optimal generator performance. If you are using our Terraform or Packer scripts, they will do this for you.

# Creating cloud images for the generator and the coordinator

You can create your own EC2 AMIs or GCP images by using [packer](https://www.packer.io/) scripts.

By default, Stressgrid images are based on Ubuntu 18.04, so you will need the same OS to build binary releases before running packer scripts, because it simply copies the release. The packer script also includes the necessary Linux kernel settings and the Systemd service.

## Creating AMIs in EC2

See packer documentation for the necessary [AWS permissions](https://www.packer.io/docs/builders/amazon.html#iam-task-or-instance-role) that should be present with specified prefixed credentials.

By default, AMIs are copied to the following regions: us-east-1, us-east-2, us-west-1 and us-west-2.

To create an AMI for the coordinator:

    $ cd coordinator
    $ AWS_ACCESS_KEY_ID=<...> AWS_SECRET_ACCESS_KEY=<...> ./packer.sh -only=amazon-ebs

To create an AMI for the generator:

    $ cd generator
    $ AWS_ACCESS_KEY_ID=<...> AWS_SECRET_ACCESS_KEY=<...> ./packer.sh -only=amazon-ebs

## Creating images in GCP

See packer documentation for the necessary [GCP service account roles](https://packer.io/docs/builders/googlecompute.html#authentication) that should be present with specified prefixed credentials.

Images are created in the project specified with `gcp_project_id` variable.

To create an image for the coordinator:

    $ cd coordinator
    $ GOOGLE_APPLICATION_CREDENTIALS=<...> ./packer.sh -only=googlecompute -var gcp_project_id=<...>

To create an image for the generator:

    $ cd generator
    $ GOOGLE_APPLICATION_CREDENTIALS=<...> ./packer.sh -only=googlecompute -var gcp_project_id=<...>

# Launching cloud instances for generator and the coordinator

When launching generator instances, you will need to pass the corresponding configuration using [EC2 user data](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/user-data.html) or [GCP startup script](https://cloud.google.com/compute/docs/startupscript).

If you are using our Terraform script, it will set this up for you.

Example:

    #!/bin/bash
    echo "COORDINATOR_URL=ws://ip-172-31-22-7.us-west-1.compute.internal:9696" > /etc/default/stressgrid-generator.env
    service stressgrid-generator restart